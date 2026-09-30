"""
tools.py — everything the agent is allowed to do.

Each tool is a plain function returning a ToolResult, registered with a name,
a description an LLM can read, and a risk tier the gate enforces.

TWO THINGS TO KNOW BEFORE EDITING

1. `adapters` at the top is the ONLY place that touches your existing repo.
   If a function name there doesn't match yours, fix it there and nothing else
   changes. Everything below is written against the adapter, not against Neo4j.

2. Every tool degrades instead of raising. A missing Neo4j, a missing resolver
   or a missing file produces `ToolResult(ok=False, reason_code=...)`, which is
   what the checker reads to decide whether to recover. A tool that raises
   kills the run; a tool that reports failure lets the agent work around it.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from .contracts import Risk, ToolResult, ToolSpec

# ===========================================================================
# ADAPTERS — the seam between this agent and the rest of EAGLE.
# ===========================================================================

_repo = None
_neo4j = None
_resolver = None
_normalizer = None
_loaded = False


def _load_backends() -> None:
    """Import the existing EAGLE modules if they are available. Absence is not
    an error — the agent runs on in-memory fixtures so the demo can't die on a
    database that didn't start.

    The `_loaded` flag matters: without it, a missing graph means every single
    tool call retries a failing import.
    """
    global _repo, _neo4j, _resolver, _normalizer, _loaded
    if _loaded:
        return
    _loaded = True
    # Preferred graph binding: the live bridge to this repo's Neo4j layer.
    # available() is True only when Neo4j actually answers, so a database that
    # is down leaves every graph tool on its in-memory path.
    try:
        from . import graph_backend as gb
        if gb.available():
            _repo, _neo4j = gb, gb
        else:
            _repo = _neo4j = None
    except Exception:
        _repo = _neo4j = None
    if _repo is None:
        try:
            from entity_resolution.graph.repository import graph_repository as repo
            from entity_resolution.graph.db import neo4j_client
            _repo, _neo4j = repo, neo4j_client
        except Exception:
            _repo = _neo4j = None
    # Preferred binding: the live bridge to this repo's real nlp/ resolver.
    # It handles the import-path and shape differences between nlp/ and what
    # the agent expects; both _resolver and _normalizer point at it, so
    # _resolver_fn() finds deduplicate/name_similarity and _norm() finds
    # normalize_name on the same module.
    try:
        from . import eagle_backend as eb
        if eb.available():
            _resolver = _normalizer = eb
            return
    except Exception:
        pass
    try:
        from entity_resolution.nlp import entity_resolver as er
        from entity_resolution.nlp import normalizer as nz
        _resolver, _normalizer = er, nz
    except Exception:
        try:                                   # flat layout fallback
            from nlp import entity_resolver as er      # type: ignore
            from nlp import normalizer as nz            # type: ignore
            _resolver, _normalizer = er, nz
        except Exception:
            _resolver = _normalizer = None


def backends() -> Dict[str, bool]:
    _load_backends()
    return {"graph": _repo is not None, "resolver": _resolver is not None,
            "normalizer": _normalizer is not None}


def _resolver_fn(*candidates: str):
    """Find one of several possible function names on the resolver module.

    The resolver was written before this agent existed and its functions are
    not named to suit it. Rather than rename anything in working, tested code,
    the adapter looks for whichever name is actually there — and returns None
    if none is, which puts the tool on its fixture path instead of crashing.
    """
    _load_backends()
    if _resolver is None:
        return None
    for name in candidates:
        fn = getattr(_resolver, name, None)
        if callable(fn):
            return fn
    return None


# ===========================================================================
# In-memory fixture — used when the graph is unavailable, and by the eval
# harness so runs are deterministic. Mirrors the seeded demo case.
# ===========================================================================

FIXTURE: Dict[str, Any] = {
    "cases": {
        "CASE-101": {"id": "CASE-101", "title": "Vehicle theft, Ambattur",
                     "persons": ["Shri. RAVI KUMAR"], "station": "Ambattur"},
        "CASE-104": {"id": "CASE-104", "title": "Online investment fraud",
                     "persons": ["Thiru Suresh Nair"], "station": "Anna Salai"},
        "CASE-109": {"id": "CASE-109", "title": "Hawala transfers",
                     "persons": ["A. Prasad"], "station": "Velachery"},
    },
    "cdr": [
        {"caller": "Ravi Kumar", "caller_phone": "+91 98765 43210",
         "receiver": "S. Nair", "receiver_phone": "9445123456", "calls": 14},
        {"caller": "Murugan Krishnan", "caller_phone": "9840112233",
         "receiver": "R. Kumar", "receiver_phone": "9876543210", "calls": 11},
        {"caller": "Murugan Krishnan", "caller_phone": "9840112233",
         "receiver": "Suresh Nair", "receiver_phone": "9445123456", "calls": 9},
        {"caller": "Murugan Krishnan", "caller_phone": "9840112233",
         "receiver": "Arun Prasad", "receiver_phone": "9962778899", "calls": 8},
        # A second, unrelated Arun Prasad. Same name, different phone, no
        # contact in common. Merging these two would put an innocent man
        # inside a fraud case, which is the failure this project cares about
        # most. Only the real resolver's ambiguity pass keeps them apart.
        {"caller": "Arun Prasad", "caller_phone": "9003441122",
         "receiver": "Latha Venkat", "receiver_phone": "9840776655", "calls": 3},
    ],
    "financial": [
        {"sender": "Suresh Nair", "sender_acc": "50100234567890",
         "receiver": "ARUN PRASAD", "receiver_acc": "50100987654321",
         "transfers": 6, "amount": 600000},
        {"sender": "A. Prasad", "sender_acc": "50100987654321",
         "receiver": "MURUGAN K", "receiver_acc": "50100555000777",
         "transfers": 5, "amount": 200000},
    ],
    "vehicle": [
        {"number": "TN 01 AB 1234", "owner": "K. Murugan",
         "address": "7, Bazaar Street, Porur, Chennai - 600116"},
        # Deliberate: the RTO holds this one under an initial, while the FIR
        # names the same man in full. A plain name search misses it. This is
        # the record the identity-aware retry is there to find, and the reason
        # the failure in the trace is worth keeping rather than hiding.
        {"number": "TN 09 BX 4471", "owner": "S. Nair",
         "address": "12, Lake View Road, Anna Nagar, Chennai - 600040"},
    ],
}

# Known spelling variants. In production this is derived from the resolver's
# own clusters; the fixture keeps the demo reproducible.
FIXTURE_VARIANTS: Dict[str, List[str]] = {
    "ravi kumar": ["Shri. RAVI KUMAR", "R. Kumar", "ravi kumar", "Kumar, Ravi"],
    "suresh nair": ["Thiru Suresh Nair", "S. Nair", "SURESH NAIR", "Suresh Nair"],
    "arun prasad": ["A. Prasad", "ARUN PRASAD", "Arun Prasad"],
    "k murugan": ["K. Murugan", "Murugan Krishnan", "MURUGAN K",
                  "Krishnan Murugan", "K Murugan", "Murugan"],
}


def _initial_form_of(a: str, b: str) -> bool:
    """True when one name is the other written with an initial:
    's nair' vs 'suresh nair'. Same surname, same first letter, one side
    abbreviated. Not a merge rule — only a reason to ask."""
    ta, tb = a.split(), b.split()
    if len(ta) < 2 or len(tb) < 2 or ta[1:] != tb[1:]:
        return False
    short, long_ = (ta[0], tb[0]) if len(ta[0]) < len(tb[0]) else (tb[0], ta[0])
    return len(short) == 1 and len(long_) > 1 and long_.startswith(short)


def _norm(name: str) -> str:
    # Baseline: no normalization at all. An agent without this NLP layer
    # compares the strings it was given, so "Shri. RAVI KUMAR" and
    # "Ravi Kumar" are two different men to it. Stripping honorifics is
    # already part of what is being measured, so the baseline must not get it.
    if os.getenv("EAGLE_BASELINE") == "1":
        return " ".join(str(name).lower().split())

    _load_backends()
    if _normalizer is not None:
        try:
            s = _normalizer.normalize_name(name)
            # The repo normalizer strips shri/smt/mr/dr but not the Tamil
            # honorifics an FIR actually uses ("Thiru Suresh Nair",
            # "Selvi Meena Rajan"). Strip that residual set here, at the
            # adapter seam, rather than editing nlp/normalizer.py.
            for h in ("thiru", "thirumathi", "selvi", "selvan", "tr"):
                s = re.sub(rf"\b{h}\b", " ", s)
            return " ".join(s.split())
        except Exception:
            pass
    s = re.sub(r"[^a-z\s]", " ", str(name).lower())
    for h in ("shri", "thiru", "smt", "selvi", "mr", "mrs", "dr"):
        s = re.sub(rf"\b{h}\b", " ", s)
    return " ".join(s.split())


# ===========================================================================
# Tool registry
# ===========================================================================

_REGISTRY: Dict[str, Dict[str, Any]] = {}


def tool(name: str, description: str, risk: Risk, args: Dict[str, str]):
    def deco(fn: Callable[..., ToolResult]):
        _REGISTRY[name] = {
            "fn": fn,
            "spec": ToolSpec(name=name, description=description, risk=risk,
                             args=args),
        }
        return fn
    return deco


def specs() -> List[Dict]:
    return [v["spec"].to_dict() for v in _REGISTRY.values()]


def spec_of(name: str) -> Optional[ToolSpec]:
    entry = _REGISTRY.get(name)
    return entry["spec"] if entry else None


def call(tool_name: str, /, **kwargs) -> ToolResult:
    """Positional-only first argument, so a tool may itself take `name=`."""
    entry = _REGISTRY.get(tool_name)
    if entry is None:
        return ToolResult(ok=False, error=f"no such tool: {tool_name}",
                          reason_code="unknown_tool")
    try:
        return entry["fn"](**kwargs)
    except TypeError as exc:
        return ToolResult(ok=False, error=f"bad arguments for {tool_name}: {exc}",
                          reason_code="bad_arguments")
    except Exception as exc:                                   # noqa: BLE001
        return ToolResult(ok=False, error=f"{type(exc).__name__}: {exc}",
                          reason_code="tool_exception")


# ===========================================================================
# READ tools — tier AUTO
# ===========================================================================

@tool("read_case", "Open a case file and return its details and the people "
                   "named in it.", Risk.AUTO, {"case_id": "e.g. CASE-104"})
def read_case(case_id: str) -> ToolResult:
    _load_backends()
    if _repo is not None:
        try:
            fn = getattr(_repo, "get_case", None) or getattr(_repo, "find_case", None)
            if fn:
                rec = fn(case_id)
                if rec:
                    return ToolResult(ok=True, data=rec,
                                      facts={"case": rec})
        except Exception:
            pass
    rec = FIXTURE["cases"].get(case_id)
    if not rec:
        return ToolResult(ok=False, error=f"case {case_id} not found",
                          reason_code="not_found")
    return ToolResult(ok=True, data=rec, facts={"case": rec,
                                                "persons": rec["persons"]})


@tool("search_cdr", "Search call records for a person by name or phone "
                    "number.", Risk.AUTO,
      {"name": "person's name as written", "phone": "optional phone number"})
def search_cdr(name: str = "", phone: str = "") -> ToolResult:
    hits = []
    n = _norm(name) if name else ""
    p = re.sub(r"\D", "", phone)[-10:] if phone else ""
    for row in FIXTURE["cdr"]:
        for side in ("caller", "receiver"):
            if n and _norm(row[side]) == n:
                hits.append(row)
                break
            if p and re.sub(r"\D", "", row[f"{side}_phone"])[-10:] == p:
                hits.append(row)
                break
    if not hits:
        # THE important failure. reason_code drives the recovery loop.
        return ToolResult(
            ok=False,
            error=f"no call records for {name or phone!r}",
            reason_code="no_results",
            facts={"searched_name": name, "searched_phone": phone},
        )
    return ToolResult(ok=True, data=hits,
                      facts={"cdr_hits": len(hits), "cdr": hits})


@tool("search_financial", "Search bank transfers for a person or account.",
      Risk.AUTO, {"name": "person's name", "account": "optional account no."})
def search_financial(name: str = "", account: str = "") -> ToolResult:
    hits = []
    n = _norm(name) if name else ""
    a = re.sub(r"\D", "", account) if account else ""
    for row in FIXTURE["financial"]:
        if (n and _norm(row["sender"]) == n) or (n and _norm(row["receiver"]) == n) \
           or (a and a in (row["sender_acc"], row["receiver_acc"])):
            hits.append(row)
    if not hits:
        return ToolResult(ok=False,
                          error=f"no transfers for {name or account!r}",
                          reason_code="no_results",
                          facts={"searched_name": name})
    return ToolResult(ok=True, data=hits, facts={"financial": hits})


@tool("search_vehicle", "Look up a vehicle registration or an owner.",
      Risk.AUTO, {"number": "plate", "owner": "owner name"})
def search_vehicle(number: str = "", owner: str = "") -> ToolResult:
    hits = [r for r in FIXTURE["vehicle"]
            if (number and re.sub(r"\W", "", number).upper()
                == re.sub(r"\W", "", r["number"]).upper())
            or (owner and _norm(owner) == _norm(r["owner"]))]
    if not hits:
        return ToolResult(ok=False, error="no vehicle record",
                          reason_code="no_results")
    return ToolResult(ok=True, data=hits, facts={"vehicle": hits})


# ===========================================================================
# THINK tools — tier AUTO, except an uncertain merge which escalates
# ===========================================================================

@tool("get_name_variants",
      "Return every spelling of a name that belongs to the same person. Call "
      "this after a search returns nothing, then search again with each "
      "variant.", Risk.AUTO, {"name": "the name that found nothing"})
def get_name_variants(name: str) -> ToolResult:
    """The tool that makes recovery possible.

    A plain agent that searches for "Ravi Kumar" and finds nothing reports
    failure. This lets it ask who else that person is called, and try again.
    """
    _load_backends()
    key = _norm(name)
    pool = [v for vs in FIXTURE_VARIANTS.values() for v in vs]
    variants: List[str] = []

    # Signal 1 — the resolver's own name score, when it is wired in. This
    # catches typos and transliteration ('Krishnan' / 'Krisnan') that a rule
    # would miss.
    sim = _resolver_fn("name_similarity", "compare_names", "name_score")
    if sim is not None:
        try:
            variants += [v for v in pool if float(sim(name, v)) >= 0.85]
        except Exception:
            pass

    # Signal 2 — same-cluster lookup by normalized key, plus the initial-form
    # rule. This has to run ALONGSIDE the resolver score, not only as its
    # fallback: EAGLE's name_similarity is built for pairwise dedup, where a
    # shared phone or address confirms the match, so on a bare name it rates
    # an initialized form ('S. Nair' vs 'Suresh Nair') well below 0.85 and
    # would never surface it. Yet an initial is exactly how a name differs
    # between an FIR and an RTO record — the record the retry exists to find.
    cluster = FIXTURE_VARIANTS.get(key, [])
    if not cluster and key:
        for k, vs in FIXTURE_VARIANTS.items():
            if key in k or k in key or _initial_form_of(key, k):
                cluster = vs
                break
    variants += cluster

    variants = [v for v in dict.fromkeys(variants) if _norm(v) != key or v != name]
    if not variants:
        return ToolResult(ok=False, error=f"no known variants of {name!r}",
                          reason_code="no_variants")
    return ToolResult(ok=True, data=variants,
                      facts={"variants_of": name, "variants": variants})


@tool("resolve_entities",
      "Decide which of the collected records describe the same person. "
      "Confident matches are merged; uncertain ones are returned for a human.",
      Risk.AUTO, {"records": "list of {name, phone, address, account}"})
def resolve_entities(records: List[Dict]) -> ToolResult:
    _load_backends()
    if not records:
        return ToolResult(ok=False, error="nothing to resolve",
                          reason_code="empty_input")

    # Baseline: match identities on the exact string, which is what an agent
    # without entity resolution underneath does. No normalization, no
    # variants, no flagging. Every spelling becomes its own person.
    if os.getenv("EAGLE_BASELINE") == "1":
        groups: Dict[str, List[Dict]] = {}
        for r in records:
            groups.setdefault(str(r.get("name", "")).strip(), []).append(r)
        entities = [
            {"entity_id": f"ENT{i:05d}", "canonical": {"name": k},
             "variants": {"name": [k]}, "record_count": len(v),
             "confidence": 1.0}
            for i, (k, v) in enumerate(sorted(groups.items()), 1) if k
        ]
        return ToolResult(ok=True,
                          data={"entities": entities, "flagged": [],
                                "stats": {"input_records": len(records),
                                          "unique_entities": len(entities),
                                          "mode": "baseline_exact_string"}},
                          facts={"entities": entities, "flagged": []})

    dedup = _resolver_fn("deduplicate", "resolve_all", "cluster_records")
    if dedup is not None:
        try:
            out = dedup(records)
            return ToolResult(
                ok=True, data=out,
                facts={
                    "entities": out.get("entities", []),
                    "flagged": out.get("flagged", []),
                    "resolution_stats": out.get("stats", {}),
                },
            )
        except Exception as exc:                               # noqa: BLE001
            return ToolResult(ok=False, error=f"resolver failed: {exc}",
                              reason_code="resolver_error")

    # Fallback: group by normalized name so the demo still shows resolution.
    groups: Dict[str, List[Dict]] = {}
    for r in records:
        groups.setdefault(_norm(r.get("name", "")), []).append(r)
    entities = [
        {"entity_id": f"ENT{i:05d}",
         "canonical": {"name": k.title()},
         "variants": {"name": [r.get("name") for r in v]},
         "record_count": len(v),
         "confidence": 1.0 if len(v) == 1 else 0.95}
        for i, (k, v) in enumerate(sorted(groups.items()), 1) if k
    ]

    # Second pass: near-matches the fallback will NOT merge on its own.
    # "S Nair" and "Suresh Nair" are probably one man, but probably is not
    # good enough to put a name inside a case file, so each pair is handed to
    # the officer with the reason spelled out instead of being merged quietly.
    flagged = []
    for i, a in enumerate(entities):
        for b in entities[i + 1:]:
            if _initial_form_of(_norm(a["canonical"]["name"]),
                                _norm(b["canonical"]["name"])):
                flagged.append({
                    "entities_to_merge": [a["entity_id"], b["entity_id"]],
                    "confidence": 0.85,
                    "reasons": [
                        f"{a['canonical']['name']!r} and "
                        f"{b['canonical']['name']!r} agree on the surname and "
                        f"the first initial.",
                        "No phone number, account or address appears in both "
                        "records, so there is nothing to confirm it with.",
                        "Only above 0.90 does the system merge on its own. "
                        "This scores 0.85, so it waits for you.",
                    ],
                    "preview": {"a": a, "b": b},
                })

    return ToolResult(ok=True,
                      data={"entities": entities, "flagged": flagged,
                            "stats": {"input_records": len(records),
                                      "unique_entities": len(entities),
                                      "flagged_for_review": len(flagged)}},
                      facts={"entities": entities, "flagged": flagged})


@tool("build_graph", "Write resolved people and their links into the case "
                     "graph.", Risk.AUTO,
      {"entities": "resolved entities", "links": "relationships",
       "case_id": "the case these people belong to"})
def build_graph(entities: List[Dict], links: Optional[List[Dict]] = None,
                case_id: str = "") -> ToolResult:
    _load_backends()
    links = links or []
    if _repo is not None:
        try:
            # Preferred: one batch write that also creates the Case node and
            # the LINKED_TO edges, so the graph is navigable, not just a heap
            # of unconnected Person nodes.
            builder = getattr(_repo, "build_case_graph", None)
            if builder is not None:
                out = builder(case_id=case_id, entities=entities, links=links)
                return ToolResult(ok=True, data=out,
                                  facts={"graph_nodes": out.get("nodes", 0),
                                         "graph_edges": out.get("edges", 0)})
            created = []
            for e in entities:
                created.append(_repo.create_entity({
                    "type": "PERSON",
                    "entity_id": e.get("entity_id"),
                    "label": (e.get("canonical") or {}).get("name", "unknown"),
                    "primaryIdentifier": (e.get("canonical") or {}).get("phone", ""),
                    "sources": e.get("sources", []),
                    "confidence": e.get("confidence", 0.0),
                    "status": "PENDING_REVIEW",
                }))
            return ToolResult(ok=True, data={"nodes": len(created)},
                              facts={"graph_nodes": len(created)})
        except Exception as exc:                               # noqa: BLE001
            return ToolResult(ok=False, error=f"graph write failed: {exc}",
                              reason_code="graph_unavailable")
    return ToolResult(ok=True,
                      data={"nodes": len(entities), "edges": len(links),
                            "mode": "in-memory"},
                      facts={"graph_nodes": len(entities)})


@tool("find_connector",
      "Find the person who links the most cases — the one an investigator "
      "would otherwise miss.", Risk.AUTO, {"entities": "resolved entities"})
def find_connector(entities: List[Dict]) -> ToolResult:
    if not entities:
        return ToolResult(ok=False, error="no entities", reason_code="empty_input")
    best, best_n = None, 0
    for e in entities:
        n = e.get("record_count", 0)
        srcs = len(e.get("sources", []) or [])
        score = n + srcs
        if score > best_n:
            best, best_n = e, score
    if best is None:
        return ToolResult(ok=False, error="no connector found",
                          reason_code="no_results")
    name = (best.get("canonical") or {}).get("name", "unknown")
    variants = (best.get("variants") or {}).get("name", [])
    return ToolResult(
        ok=True, data=best,
        facts={"connector": name, "connector_variants": variants,
               "connector_entity": best},
    )


# ===========================================================================
# ACT tools — gated
# ===========================================================================

@tool("update_case_record",
      "Write the findings into the case record. A person confirms first.",
      Risk.ASK, {"case_id": "case", "findings": "what to record"})
def update_case_record(case_id: str, findings: Any) -> ToolResult:
    _load_backends()
    if _repo is not None:
        try:
            lead = _repo.create_lead({
                "title": str(findings)[:120],
                "caseId": case_id,
                "status": "PENDING_REVIEW",
                "priorityScore": 90,
            })
            return ToolResult(ok=True, data=lead, facts={"lead_id": lead.get("id")})
        except Exception as exc:                               # noqa: BLE001
            return ToolResult(ok=False, error=f"write failed: {exc}",
                              reason_code="graph_unavailable")
    return ToolResult(ok=True, data={"case_id": case_id, "findings": findings,
                                     "mode": "in-memory"})


@tool("draft_report", "Draft the case dossier. A person reads it before it "
                      "goes anywhere.", Risk.ASK,
      {"case_id": "case", "title": "report title",
       "entities": "the resolved people", "connector": "who links the cases"})
def draft_report(case_id: str = "", title: str = "Case dossier",
                 entities: Optional[List[Dict]] = None,
                 connector: str = "") -> ToolResult:
    """Writes the run's actual findings, not a placeholder. Every person in it
    carries the confidence they were resolved at, so the officer reading the
    dossier can see which names are certain and which are not."""
    path = Path(os.getenv("EAGLE_REPORT_DIR", "reports"))
    path.mkdir(parents=True, exist_ok=True)
    f = path / f"{case_id or 'case'}_dossier.md"

    lines = [f"# {title}", "", f"Case: {case_id}", ""]
    if connector:
        lines += [f"**Common to the most cases:** {connector}", ""]
    lines += ["## People identified", ""]
    for e in (entities or []):
        name = (e.get("canonical") or {}).get("name", "?")
        conf = e.get("confidence", 0)
        seen = ", ".join((e.get("variants") or {}).get("name", []))
        lines.append(f"- **{name}** — confidence {conf:.2f}, "
                     f"{e.get('record_count', 0)} record(s). Seen as: {seen}")
    if not entities:
        lines.append("_No people were resolved in this run._")
    lines += ["", "---", "Drafted by CaseFlow Agent. Not evidence until an "
                    "officer has reviewed it."]

    f.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return ToolResult(ok=True, data={"path": str(f)}, facts={"report": str(f)})


@tool("send_email", "Send an email. Always requires a person to approve.",
      Risk.ALWAYS_ASK, {"to": "recipient", "subject": "subject", "body": "body"})
def send_email(to: str, subject: str, body: str) -> ToolResult:
    # Deliberately does not send in the demo build. Flip EAGLE_EMAIL_REAL=1
    # and wire an SMTP client here once the approval flow has been tested.
    if os.getenv("EAGLE_EMAIL_REAL", "0") != "1":
        return ToolResult(ok=True,
                          data={"simulated": True, "to": to, "subject": subject},
                          facts={"email_to": to})
    return ToolResult(ok=False, error="no mail transport configured",
                      reason_code="not_configured")
