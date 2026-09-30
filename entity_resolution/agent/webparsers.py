"""
webparsers.py — turn an uploaded file into person-records + relations.

Every parser returns (records, relations):

  records   [{record_id, source, name, phone, account, vehicle, address, case_id}]
  relations [{from: record_id, to: record_id, type: "CALLED"|"TRANSFERRED"|...}]

Records feed entity resolution; relations become Person->Person edges once each
record is mapped to its resolved entity. Parsing never raises to the caller: a
format we can't read yields ([], []) with a note, so one bad file can't take the
whole ingest down.

Supported: .csv .tsv .txt .json .gml .graphml .xml .pdf
"""

from __future__ import annotations

import io
import json
import re
from typing import Any, Dict, List, Tuple

Record = Dict[str, Any]
Relation = Dict[str, Any]
Parsed = Tuple[List[Record], List[Relation]]

_PHONE_RE = re.compile(r"(?:\+?\d[\d\s-]{7,}\d)")
_NAME_RE = re.compile(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z.]+){1,3})\b")


def _norm_key(k: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(k).lower())


# column-name synonyms → canonical field
_FIELD_SYNS = {
    "name": {"name", "person", "individual", "subject", "fullname", "owner", "holder"},
    "phone": {"phone", "mobile", "msisdn", "contact", "phoneno", "number", "cell"},
    "account": {"account", "acc", "accountno", "accountnumber", "acno"},
    "vehicle": {"vehicle", "plate", "registration", "regno", "vehicleno"},
    "address": {"address", "addr", "location", "place"},
    "case": {"case", "caseid", "fir", "firno", "caseno"},
}


def _classify_columns(cols: List[str]) -> Dict[str, str]:
    """Map each real column to a canonical field where we recognise it."""
    out: Dict[str, str] = {}
    for c in cols:
        nk = _norm_key(c)
        for field, syns in _FIELD_SYNS.items():
            if nk in syns:
                out[c] = field
                break
    return out


def _mk(source: str, i: int, **fields) -> Record:
    rec = {"record_id": f"{source}-{i:05d}", "source": source,
           "name": "", "phone": "", "account": "", "vehicle": "",
           "address": "", "case_id": ""}
    rec.update({k: ("" if v is None else str(v).strip()) for k, v in fields.items()})
    return rec


# --------------------------------------------------------------------------
# tabular (csv / tsv / txt) via pandas, with a paired-column pass for CDR/FIN
# --------------------------------------------------------------------------

def _parse_table(rows: List[Dict[str, Any]], source: str) -> Parsed:
    records: List[Record] = []
    relations: List[Relation] = []
    if not rows:
        return records, relations
    cols = list(rows[0].keys())
    low = {_norm_key(c): c for c in cols}

    def col(*names):
        for n in names:
            if n in low:
                return low[n]
        return None

    caller, receiver = col("caller", "callera", "from"), col("receiver", "callee", "to")
    caller_ph, receiver_ph = col("callerphone", "fromphone"), col("receiverphone", "tophone")
    sender, s_recv = col("sender", "payer"), col("receiver", "payee", "beneficiary")
    sender_acc, recv_acc = col("senderacc", "senderaccount"), col("receiveracc", "receiveraccount")
    owner, vehicle_no = col("owner", "name"), col("vehicle", "number", "plate", "registration")
    case_col = col("case", "caseid", "fir", "firno")
    field_map = _classify_columns(cols)

    n = 0
    for row in rows:
        cid = str(row.get(case_col, "") or "").strip() if case_col else ""

        # CDR-shaped: caller + receiver -> two people + CALLED
        if caller and receiver and str(row.get(caller, "")).strip() and str(row.get(receiver, "")).strip():
            a = _mk(source, n, name=row.get(caller), phone=row.get(caller_ph) if caller_ph else "", case_id=cid); n += 1
            b = _mk(source, n, name=row.get(receiver), phone=row.get(receiver_ph) if receiver_ph else "", case_id=cid); n += 1
            records += [a, b]
            relations.append({"from": a["record_id"], "to": b["record_id"], "type": "CALLED"})
            continue
        # Financial-shaped: sender + receiver -> two people + TRANSFERRED
        if sender and s_recv and str(row.get(sender, "")).strip() and str(row.get(s_recv, "")).strip():
            a = _mk(source, n, name=row.get(sender), account=row.get(sender_acc) if sender_acc else "", case_id=cid); n += 1
            b = _mk(source, n, name=row.get(s_recv), account=row.get(recv_acc) if recv_acc else "", case_id=cid); n += 1
            records += [a, b]
            relations.append({"from": a["record_id"], "to": b["record_id"], "type": "TRANSFERRED"})
            continue
        # generic single-person row: pull whatever recognised fields exist
        vals = {field_map[c]: row.get(c) for c in field_map}
        if owner and not vals.get("name"):
            vals["name"] = row.get(owner)
        if vehicle_no and not vals.get("vehicle"):
            v = str(row.get(vehicle_no, "") or "")
            if v and not v.replace("+", "").replace("-", "").replace(" ", "").isdigit():
                vals["vehicle"] = v
        if not vals.get("case") and cid:
            vals["case"] = cid
        if any(str(v or "").strip() for v in vals.values()):
            records.append(_mk(source, n,
                               name=vals.get("name"), phone=vals.get("phone"),
                               account=vals.get("account"), vehicle=vals.get("vehicle"),
                               address=vals.get("address"), case_id=vals.get("case")))
            n += 1
    return records, relations


def _parse_csv_bytes(data: bytes, sep: str, source: str) -> Parsed:
    import pandas as pd
    try:
        df = pd.read_csv(io.BytesIO(data), sep=sep, dtype=str, keep_default_na=False)
    except Exception:
        return [], []
    rows = df.to_dict(orient="records")
    return _parse_table(rows, source)


# --------------------------------------------------------------------------
# json — record list, {records:[...]}, or a {nodes:[],edges:[]} graph
# --------------------------------------------------------------------------

def _parse_json(data: bytes, source: str) -> Parsed:
    try:
        obj = json.loads(data.decode("utf-8", "replace"))
    except Exception:
        return [], []
    if isinstance(obj, dict) and ("nodes" in obj or "edges" in obj):
        return _parse_node_edge(obj.get("nodes", []), obj.get("edges", []), source)
    rows = obj.get("records", obj) if isinstance(obj, dict) else obj
    if not isinstance(rows, list):
        return [], []
    rows = [r for r in rows if isinstance(r, dict)]
    return _parse_table(rows, source)


def _parse_node_edge(nodes: List[Dict], edges: List[Dict], source: str) -> Parsed:
    records: List[Record] = []
    id_to_rid: Dict[str, str] = {}
    for i, nd in enumerate(nodes):
        nid = str(nd.get("id", nd.get("name", i)))
        name = str(nd.get("name", nd.get("label", nid)))
        rec = _mk(source, i, name=name, phone=str(nd.get("phone", "")),
                  case_id=str(nd.get("case", "")))
        id_to_rid[nid] = rec["record_id"]
        records.append(rec)
    relations = []
    for e in edges:
        s = id_to_rid.get(str(e.get("source", e.get("from"))))
        t = id_to_rid.get(str(e.get("target", e.get("to"))))
        if s and t:
            relations.append({"from": s, "to": t,
                              "type": str(e.get("type", e.get("label", "LINKED_TO"))).upper()})
    return records, relations


# --------------------------------------------------------------------------
# gml / graphml via networkx
# --------------------------------------------------------------------------

def _parse_graph_nx(data: bytes, kind: str, source: str) -> Parsed:
    import networkx as nx
    text = data.decode("utf-8", "replace")
    try:
        if kind == "gml":
            G = nx.parse_gml(text, label=None)
        else:
            G = nx.read_graphml(io.BytesIO(data))
    except Exception:
        return [], []
    nodes, edges = [], []
    for nid, attrs in G.nodes(data=True):
        nodes.append({"id": nid,
                      "name": attrs.get("name") or attrs.get("label") or str(nid),
                      "phone": attrs.get("phone", ""), "case": attrs.get("case", "")})
    for a, b, attrs in G.edges(data=True):
        edges.append({"source": a, "target": b,
                      "type": attrs.get("type") or attrs.get("label") or "LINKED_TO"})
    return _parse_node_edge(nodes, edges, source)


# --------------------------------------------------------------------------
# xml — best effort: elements carrying name/phone
# --------------------------------------------------------------------------

def _parse_xml(data: bytes, source: str) -> Parsed:
    import xml.etree.ElementTree as ET
    try:
        root = ET.fromstring(data.decode("utf-8", "replace"))
    except Exception:
        return [], []
    records, n = [], 0
    for el in root.iter():
        attrs = {_norm_key(k): v for k, v in el.attrib.items()}
        name = attrs.get("name") or (el.text.strip() if el.text and el.tag.lower() in ("name", "person") else "")
        phone = attrs.get("phone") or attrs.get("mobile") or ""
        if name or phone:
            records.append(_mk(source, n, name=name, phone=phone,
                               account=attrs.get("account", ""),
                               case_id=attrs.get("case", "")))
            n += 1
    return records, []


# --------------------------------------------------------------------------
# pdf — extract text, then names + phones
# --------------------------------------------------------------------------

def _parse_pdf(data: bytes, source: str) -> Parsed:
    try:
        from pdfminer.high_level import extract_text
        text = extract_text(io.BytesIO(data)) or ""
    except Exception:
        return [], []
    records, n = [], 0
    phones = _PHONE_RE.findall(text)
    names = _NAME_RE.findall(text)
    for nm in dict.fromkeys(names):
        records.append(_mk(source, n, name=nm)); n += 1
    for ph in dict.fromkeys(phones):
        records.append(_mk(source, n, name="", phone=ph)); n += 1
    return records, []


# --------------------------------------------------------------------------
# dispatch
# --------------------------------------------------------------------------

def parse(filename: str, data: bytes) -> Parsed:
    name = (filename or "").lower()
    src = re.sub(r"[^a-z0-9]+", "", name.rsplit("/", 1)[-1].split(".")[0])[:12] or "file"
    try:
        if name.endswith(".csv"):
            return _parse_csv_bytes(data, ",", src)
        if name.endswith(".tsv") or name.endswith(".tab"):
            return _parse_csv_bytes(data, "\t", src)
        if name.endswith(".txt"):
            # try comma then tab
            recs, rels = _parse_csv_bytes(data, ",", src)
            return (recs, rels) if recs else _parse_csv_bytes(data, "\t", src)
        if name.endswith(".json"):
            return _parse_json(data, src)
        if name.endswith(".gml"):
            return _parse_graph_nx(data, "gml", src)
        if name.endswith(".graphml") or name.endswith(".xml") and b"graphml" in data[:400].lower():
            return _parse_graph_nx(data, "graphml", src)
        if name.endswith(".xml"):
            return _parse_xml(data, src)
        if name.endswith(".pdf"):
            return _parse_pdf(data, src)
    except Exception:
        return [], []
    return [], []


SUPPORTED = [".csv", ".tsv", ".txt", ".json", ".gml", ".graphml", ".xml", ".pdf"]
