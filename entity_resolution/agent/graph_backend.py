"""
graph_backend.py — the live bridge from this agent to EAGLE's Neo4j graph.

The agent's build_graph / update_case_record tools were written against a
repository object with create_entity()/create_lead()/get_case(). The real
repo has no such object; it has app.services.graph_builder (upsert_node,
upsert_relationship) over app.db.neo4j_client.run_query. This module is the
seam: it presents the names the adapter looks for, implemented on the real
graph layer, and adds build_case_graph() to write a whole resolved case in
one call (Person nodes + Case node + LINKED_TO edges).

Binding rule, identical to the resolver bridge: available() is True only when
Neo4j actually answers. A database that is down leaves build_graph on its
in-memory path exactly as before — a demo can't die on a container that did
not start. Nothing under backend/ is modified.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

_gb = None          # app.services.graph_builder
_nc = None          # app.db.neo4j_client
_ready: Optional[bool] = None


def _port_open(nc: Any, timeout: float = 0.75) -> bool:
    """Sub-second TCP probe of the bolt port, so a down Neo4j is settled fast
    instead of waiting out the driver's ~30s connect timeout."""
    import socket
    from urllib.parse import urlparse
    try:
        uri = getattr(nc, "settings", None)
        uri = uri.neo4j_uri if uri else None
    except Exception:
        uri = None
    if not uri:
        try:
            from app.config import settings          # type: ignore
            uri = settings.neo4j_uri
        except Exception:
            uri = "bolt://localhost:7687"
    parsed = urlparse(uri)
    host, port = parsed.hostname or "localhost", parsed.port or 7687
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False


def _find_backend_dir() -> Optional[Path]:
    """Locate the repo's backend/ (holds the `app` package). The agent lives
    at <repo>/entity_resolution/agent/, so walk up to the repo root."""
    here = Path(__file__).resolve()
    for base in [*here.parents, Path.cwd()]:
        cand = base / "backend"
        if (cand / "app" / "db" / "neo4j_client.py").exists():
            return cand
    return None


def _load() -> bool:
    """Import the real graph modules AND confirm Neo4j answers. Import success
    alone is not enough — the driver connects lazily, so we run a trivial query
    and only report available on a real round-trip."""
    global _gb, _nc, _ready
    if _ready is not None:
        return _ready
    # Hard off-switch. The eval harness sets this: measuring the NLP resolver
    # must not depend on a database being up, and a graph write can never be
    # allowed to move the resolution numbers. build_graph then stays on its
    # in-memory path, which changes nothing about the entities or the connector.
    if os.getenv("EAGLE_DISABLE_GRAPH") == "1":
        _ready = False
        return False
    backend = _find_backend_dir()
    if backend is None:
        _ready = False
        return False
    p = str(backend)
    if p not in sys.path:
        sys.path.insert(0, p)
    try:
        from app.db import neo4j_client as nc          # type: ignore
        from app.services import graph_builder as gb    # type: ignore
        # Fast fail when the DB is down: the neo4j driver's own connect timeout
        # is ~30s, which would stall every agent run while Neo4j is not up.
        # A sub-second socket probe on the bolt port settles it first.
        if not _port_open(nc):
            raise ConnectionError("neo4j bolt port not reachable")
        nc.run_query("RETURN 1 AS ok")                  # real connectivity probe
        _nc, _gb = nc, gb
        try:
            gb.ensure_constraints()
        except Exception:
            pass
        _ready = True
    except Exception:
        _nc = _gb = None
        _ready = False
    return _ready


def available() -> bool:
    return _load()


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def _slug(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", str(text).lower()).strip("-")
    return s or "unknown"


def _node_id(props: Dict[str, Any]) -> str:
    return str(props.get("entity_id")
               or props.get("id")
               or props.get("primaryIdentifier")
               or _slug(props.get("label") or props.get("name") or "person"))


# --------------------------------------------------------------------------
# Names the adapter looks for on the repo object
# --------------------------------------------------------------------------

def create_entity(props: Dict[str, Any]) -> Dict[str, Any]:
    """Upsert one Person node. Idempotent on its id, so re-running a case does
    not duplicate people."""
    if not _load():
        return {"id": _node_id(props), "mode": "in-memory", **props}
    nid = _node_id(props)
    node = _gb.upsert_node("Person", nid, {
        "name": props.get("label") or props.get("name") or "unknown",
        "primaryIdentifier": props.get("primaryIdentifier", ""),
        "status": props.get("status", "PENDING_REVIEW"),
        "sources": list(props.get("sources", []) or []),
        "confidence": float(props.get("confidence", 0.0) or 0.0),
    })
    return {"id": nid, "node": node}


def create_lead(props: Dict[str, Any]) -> Dict[str, Any]:
    """Record a finding against the Case node. Leads proper live in Postgres
    (with auth and a case FK); this writes the graph-visible marker so the
    agent's write path lands somewhere real without reaching into that stack."""
    case_id = props.get("caseId") or props.get("case_id") or "CASE"
    if not _load():
        return {"id": f"lead-{_slug(case_id)}", "mode": "in-memory", **props}
    _nc.run_query(
        "MERGE (c:Case {id: $id}) "
        "SET c.latestLead = $title, c.leadStatus = $status, "
        "    c.leadPriority = $priority RETURN c.id AS id",
        {"id": case_id, "title": str(props.get("title", ""))[:200],
         "status": props.get("status", "PENDING_REVIEW"),
         "priority": props.get("priorityScore", 0)},
    )
    return {"id": f"lead-{_slug(case_id)}", "caseId": case_id}


# Deliberately no get_case(): case metadata (which people an FIR names) is the
# investigation's seed data, not something to read back out of a graph the
# agent is only ever writing to. read_case therefore keeps using its source of
# record, and the graph stays a pure write target for resolved entities.


# --------------------------------------------------------------------------
# The batch write the enhanced build_graph prefers
# --------------------------------------------------------------------------

def build_case_graph(case_id: str, entities: List[Dict],
                     links: Optional[List[Dict]] = None) -> Dict[str, Any]:
    """Write a whole resolved case: a Case node, one Person per resolved
    entity linked to the case, and LINKED_TO edges among co-resolved people.
    Everything is MERGE, so the graph the frontend reads is updated in place
    rather than duplicated."""
    if not _load():
        return {"nodes": len(entities), "edges": len(links or []),
                "mode": "in-memory"}
    links = links or []
    if case_id:
        _nc.run_query("MERGE (c:Case {id: $id}) "
                      "SET c.status = coalesce(c.status,'ACTIVE')",
                      {"id": case_id})

    ids: List[str] = []
    for e in entities:
        canonical = (e.get("canonical") or {})
        nid = _node_id({"entity_id": e.get("entity_id"),
                        "label": canonical.get("name"),
                        "primaryIdentifier": canonical.get("phone")})
        _gb.upsert_node("Person", nid, {
            "name": canonical.get("name", "unknown"),
            "primaryIdentifier": canonical.get("phone", ""),
            "status": "PENDING_REVIEW",
            "sources": list(e.get("sources", []) or []),
            "confidence": float(e.get("confidence", 0.0) or 0.0),
            "recordCount": int(e.get("record_count", 0) or 0),
        })
        ids.append(nid)
        if case_id:
            _nc.run_query(
                "MATCH (p:Person {id:$pid}), (c:Case {id:$cid}) "
                "MERGE (p)-[r:LINKED_TO]->(c) SET r.source='caseflow_agent'",
                {"pid": nid, "cid": case_id})

    edges = 0
    # Explicit links if the caller supplied them, else connect everyone the
    # run resolved for this case so the picture is navigable.
    pairs = ([(l.get("from"), l.get("to")) for l in links]
             if links else
             [(ids[i], ids[j]) for i in range(len(ids)) for j in range(i + 1, len(ids))])
    for a, b in pairs:
        if not a or not b or a == b:
            continue
        _gb.upsert_relationship("Person", a, "Person", b, "LINKED_TO",
                                source="caseflow_agent", confidence=0.5)
        edges += 1

    return {"nodes": len(ids), "edges": edges, "case": case_id,
            "mode": "neo4j"}
