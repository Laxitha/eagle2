"""
webstore.py — the demo backend's state and read/write API.

An in-memory case store that starts EMPTY. Uploading a file is the only thing
that fills it: the file is parsed (webparsers), the person-records are resolved
into unified entities by the real resolver, and a graph + a ranked lead list
are rebuilt from scratch. Every read endpoint (stats, graph, leads) reflects
exactly what has been uploaded — nothing is seeded, so an untouched install
shows zeros and an empty canvas.

This is the dev/demo host only. The production backend keeps its own Postgres +
Neo4j implementations; these routes live on the agent dev server.
"""

from __future__ import annotations

import copy
import re
import threading
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, UploadFile
from pydantic import BaseModel

from . import webparsers

_lock = threading.Lock()

STATE: Dict[str, Any] = {
    "files": [],        # [{name, records, relations}]
    "records": [],      # all person-records
    "relations": [],    # all raw record->record relations
    "entities": [],     # resolved unified entities
    "nodes": [],        # graph nodes (frontend shape)
    "edges": [],        # graph edges (frontend shape)
    "cases": [],        # distinct case ids
    "leads": [],        # ranked leads
}

# History is an activity log that deliberately SURVIVES reset(), so clearing the
# working data still leaves a record of what was uploaded, asked, and found —
# including graph/lead snapshots you can look back at.
HISTORY: List[Dict[str, Any]] = []
_hcount = 0


def _log(kind: str, label: str, detail: str = "", snapshot: Optional[Dict] = None) -> Dict:
    global _hcount
    _hcount += 1
    ev = {"id": f"h{_hcount:04d}", "ts": time.time(), "kind": kind,
          "label": label, "detail": detail, "snapshot": snapshot}
    HISTORY.append(ev)
    return ev


def reset() -> None:
    with _lock:
        had = len(STATE["records"])
        for k in ("files", "records", "relations", "entities", "nodes", "edges", "cases", "leads"):
            STATE[k] = []
        if had:
            _log("clear", "Cleared working data", f"{had} records removed")


# --------------------------------------------------------------------------
# resolution
# --------------------------------------------------------------------------

def _resolve(records: List[Dict]) -> List[Dict]:
    """Cluster records into unified entities. Uses the real resolver when it is
    bound; falls back to normalized-name grouping so the demo still works if the
    NLP layer is unavailable. Either way each entity carries member_record_ids."""
    if not records:
        return []
    try:
        from . import tools
        tools._load_backends()
        res = tools._resolver
        if res is not None and hasattr(res, "deduplicate"):
            out = res.deduplicate(records)
            ents = out.get("entities", [])
            if ents and "member_record_ids" in ents[0]:
                return ents
    except Exception:
        pass
    # fallback: group by normalized name
    def norm(s: str) -> str:
        return " ".join(re.sub(r"[^a-z\s]", " ", str(s).lower()).split())
    groups: Dict[str, List[Dict]] = {}
    for r in records:
        groups.setdefault(norm(r.get("name", "")) or r["record_id"], []).append(r)
    ents = []
    for i, (k, members) in enumerate(sorted(groups.items()), 1):
        names = list(dict.fromkeys(m.get("name", "") for m in members if m.get("name")))
        ents.append({
            "entity_id": f"ENT{i:05d}",
            "canonical": {"name": max(names, key=len) if names else k,
                          "phone": next((m.get("phone") for m in members if m.get("phone")), "")},
            "variants": {"name": names},
            "record_count": len(members),
            "member_record_ids": [m["record_id"] for m in members],
            "sources": sorted({m.get("source", "") for m in members if m.get("source")}),
            "confidence": 1.0,
        })
    return ents


# --------------------------------------------------------------------------
# rebuild graph + leads from records/relations/entities
# --------------------------------------------------------------------------

def _rebuild() -> None:
    records = STATE["records"]
    relations = STATE["relations"]
    entities = _resolve(records)
    STATE["entities"] = entities

    rec_by_id = {r["record_id"]: r for r in records}
    rid_to_ent: Dict[str, str] = {}
    for e in entities:
        for rid in e.get("member_record_ids", []):
            rid_to_ent[rid] = e["entity_id"]

    nodes: List[Dict] = []
    edges: List[Dict] = []
    seen_nodes = set()

    def add_node(nid: str, label: str, name: str):
        if nid and nid not in seen_nodes:
            seen_nodes.add(nid)
            nodes.append({"id": nid, "label": label, "name": name})

    # Person nodes (one per resolved entity)
    for e in entities:
        add_node(e["entity_id"], "Person", e["canonical"]["name"] or e["entity_id"])

    # Case, Account, Vehicle nodes + their edges to the owning person
    cases: set = set()
    for r in records:
        ent = rid_to_ent.get(r["record_id"])
        cid = (r.get("case_id") or "").strip()
        if cid:
            cases.add(cid)
            add_node(cid, "Case", cid)
            if ent:
                edges.append({"source": ent, "target": cid, "type": "LINKED_TO", "confidence": 1.0})
        acc = (r.get("account") or "").strip()
        if acc and ent:
            aid = f"ACC-{acc}"
            add_node(aid, "Account", acc)
            edges.append({"source": ent, "target": aid, "type": "OWNED", "confidence": 1.0})
        veh = (r.get("vehicle") or "").strip()
        if veh and ent:
            vid = f"VEH-{veh}"
            add_node(vid, "Vehicle", veh)
            edges.append({"source": ent, "target": vid, "type": "OWNED", "confidence": 1.0})

    # Person<->Person edges lifted from raw relations, aggregated by (pair,type)
    agg: Dict[tuple, int] = {}
    for rel in relations:
        a = rid_to_ent.get(rel.get("from"))
        b = rid_to_ent.get(rel.get("to"))
        if not a or not b or a == b:
            continue
        key = (a, b, rel.get("type", "LINKED_TO"))
        agg[key] = agg.get(key, 0) + 1
    for (a, b, typ), count in agg.items():
        edges.append({"source": a, "target": b, "type": typ,
                      "confidence": round(min(1.0, 0.6 + 0.1 * count), 2)})

    STATE["nodes"] = nodes
    STATE["edges"] = edges
    STATE["cases"] = sorted(cases)
    STATE["leads"] = _leads(entities, edges, rec_by_id, rid_to_ent)


def _leads(entities, edges, rec_by_id, rid_to_ent) -> List[Dict]:
    """Rank people by how much of the network runs through them: direct links
    plus the number of distinct cases they touch."""
    deg: Dict[str, int] = {}
    for e in edges:
        for node in (e["source"], e["target"]):
            deg[node] = deg.get(node, 0) + 1
    cases_of: Dict[str, set] = {}
    for r in STATE["records"]:
        ent = rid_to_ent.get(r["record_id"])
        cid = (r.get("case_id") or "").strip()
        if ent and cid:
            cases_of.setdefault(ent, set()).add(cid)

    scored = []
    for e in entities:
        eid = e["entity_id"]
        d = deg.get(eid, 0)
        ncases = len(cases_of.get(eid, set()))
        if d == 0 and ncases == 0:
            continue
        score = min(1.0, 0.15 * d + 0.25 * ncases)
        cross = ncases >= 2
        reason = (
            f"Connected to {d} link(s)"
            + (f" and appears in {ncases} cases" if ncases else "")
            + "."
        )
        action = ("Cross-reference open cases — this entity bridges multiple investigations."
                  if cross else
                  "Investigate immediate contacts — this entity is a network hub.")
        scored.append({
            "id": f"lead-{eid}",
            "entity_id": eid,
            "entity_name": e["canonical"]["name"] or eid,
            "score": round(score, 2),
            "reason": reason,
            "recommended_action": action,
            "status": "pending",
            "cross_case": cross,
        })
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:20]


# --------------------------------------------------------------------------
# public store ops
# --------------------------------------------------------------------------

def ingest(filename: str, data: bytes) -> Dict[str, Any]:
    records, relations = webparsers.parse(filename, data)
    with _lock:
        STATE["files"].append({"name": filename, "records": len(records),
                               "relations": len(relations)})
        STATE["records"].extend(records)
        STATE["relations"].extend(relations)
        _rebuild()
        totals = stats()
        # Snapshot the cumulative graph + leads at this point so the History
        # view can show what the picture looked like after each upload.
        snap = {"stats": totals,
                "nodes": copy.deepcopy(STATE["nodes"]),
                "edges": copy.deepcopy(STATE["edges"]),
                "leads": copy.deepcopy(STATE["leads"])}
        _log("upload", filename,
             f"{len(records)} records · {len(relations)} links", snapshot=snap)
        return {
            "file": filename,
            "parsed_records": len(records),
            "parsed_relations": len(relations),
            "totals": totals,
        }


def log_query(question: str, reply: str) -> None:
    with _lock:
        _log("query", question, reply)


def stats() -> Dict[str, Any]:
    return {
        "entities": len([n for n in STATE["nodes"] if n["label"] == "Person"]),
        "relationships": len(STATE["edges"]),
        "cases": len(STATE["cases"]),
        "files": len(STATE["files"]),
        "records": len(STATE["records"]),
    }


# --------------------------------------------------------------------------
# router
# --------------------------------------------------------------------------

router = APIRouter(prefix="/api", tags=["case-data"])


class VerifyBody(BaseModel):
    approved: bool


@router.post("/ingest")
async def api_ingest(file: UploadFile = File(...)) -> Dict[str, Any]:
    data = await file.read()
    return ingest(file.filename or "upload", data)


@router.get("/stats")
def api_stats() -> Dict[str, Any]:
    return stats()


@router.get("/graph")
def api_graph() -> Dict[str, Any]:
    return {"nodes": STATE["nodes"], "edges": STATE["edges"]}


@router.get("/leads")
def api_leads() -> Dict[str, Any]:
    return {"leads": STATE["leads"], "total": len(STATE["leads"])}


@router.post("/leads/{lead_id}/verify")
def api_verify(lead_id: str, body: VerifyBody) -> Dict[str, Any]:
    for l in STATE["leads"]:
        if l["id"] == lead_id:
            l["status"] = "verified" if body.approved else "rejected"
            return l
    return {"error": "not found"}


@router.post("/reset")
def api_reset() -> Dict[str, Any]:
    reset()
    return {"ok": True, "totals": stats()}


@router.get("/files")
def api_files() -> Dict[str, Any]:
    return {"files": STATE["files"]}


@router.get("/history")
def api_history() -> Dict[str, Any]:
    """Activity log, newest first. Snapshots are omitted here (fetched per-item)
    but their headline stats travel with upload rows for the cards."""
    out = []
    for ev in reversed(HISTORY):
        row = {"id": ev["id"], "ts": ev["ts"], "kind": ev["kind"],
               "label": ev["label"], "detail": ev["detail"],
               "has_snapshot": ev.get("snapshot") is not None}
        if ev.get("snapshot"):
            row["stats"] = ev["snapshot"].get("stats", {})
        out.append(row)
    return {"history": out, "total": len(out)}


@router.get("/history/{event_id}")
def api_history_item(event_id: str) -> Dict[str, Any]:
    for ev in HISTORY:
        if ev["id"] == event_id:
            return ev
    return {"error": "not found"}


@router.post("/history/clear")
def api_history_clear() -> Dict[str, Any]:
    HISTORY.clear()
    return {"ok": True}
