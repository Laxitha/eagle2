"""
eagle_backend.py — the live bridge from this agent to CaseFlow's real NLP layer.

`tools.py` was written to run on fixtures, and to bind to the real resolver
through the adapter seam at the top of that file. This module IS that binding
for the actual `nlp/` package in this repository. It exists because two things
differ between "what the agent asks for" and "what nlp/ provides":

  1. import path — nlp/entity_resolver.py does `from normalizer import ...`,
     which resolves only when `nlp/` itself is on sys.path (not the repo root).
     `from nlp import entity_resolver` therefore fails; a flat import works.

  2. shape — nlp.entity_resolver.deduplicate() takes EntityRecord dataclasses
     and returns pairwise ResolutionResults ({auto_merge, flagged, separate}).
     The agent hands in plain dicts and expects clustered entities
     ({entities, flagged, stats}). build_unified_entities() does the union-find
     clustering; this module maps dicts -> EntityRecord and the clusters +
     flagged pairs back into the agent's shape.

Nothing in nlp/ is modified. If the real modules cannot be imported (a missing
dependency, a moved folder), `available()` returns False and tools.py stays on
its fixture path, exactly as it does when Neo4j is down.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

_er = None          # nlp.entity_resolver
_nz = None          # nlp.normalizer
_ue = None          # nlp.unified_entity
_ready: Optional[bool] = None


def _find_nlp_dir() -> Optional[Path]:
    """Locate the repo's nlp/ directory: an explicit override, then a walk up
    from this file (agent lives at <repo>/entity_resolution/agent/), then CWD."""
    env = os.getenv("CASEFLOW_NLP_PATH")
    if env and (Path(env) / "entity_resolver.py").exists():
        return Path(env)
    here = Path(__file__).resolve()
    for base in [*here.parents, Path.cwd()]:
        cand = base / "nlp"
        if (cand / "entity_resolver.py").exists():
            return cand
    return None


def _load() -> bool:
    global _er, _nz, _ue, _ready
    if _ready is not None:
        return _ready
    nlp_dir = _find_nlp_dir()
    if nlp_dir is None:
        _ready = False
        return False
    # entity_resolver.py and unified_entity.py use flat imports
    # ("from normalizer import ...", "from entity_resolver import ..."),
    # so nlp/ itself has to be importable, not the repo root.
    p = str(nlp_dir)
    if p not in sys.path:
        sys.path.insert(0, p)
    try:
        import entity_resolver as er      # type: ignore
        import normalizer as nz           # type: ignore
        _er, _nz = er, nz
        try:
            import unified_entity as ue    # type: ignore
            _ue = ue
        except Exception:
            _ue = None                     # clustering falls back below
        _ready = True
    except Exception:
        _er = _nz = _ue = None
        _ready = False
    return _ready


def available() -> bool:
    return _load()


# --------------------------------------------------------------------------
# Proxies the adapter looks for by name (normalizer + name scorer)
# --------------------------------------------------------------------------

def normalize_name(raw: str) -> str:
    if not _load():
        return " ".join(str(raw).lower().split())
    return _nz.normalize_name(raw)


def name_similarity(a: str, b: str) -> float:
    if not _load():
        return 1.0 if str(a).lower().split() == str(b).lower().split() else 0.0
    return float(_er.name_similarity(a, b))


# --------------------------------------------------------------------------
# The clustering shim: dicts in, {entities, flagged, stats} out
# --------------------------------------------------------------------------

def _to_records(records: List[Dict]) -> List[Any]:
    ER = _er.EntityRecord
    out = []
    for i, r in enumerate(records):
        out.append(ER(
            record_id=str(r.get("record_id") or f"R{i:04d}"),
            name=str(r.get("name", "") or ""),
            phone=str(r.get("phone", "") or ""),
            address=str(r.get("address", "") or ""),
            vehicle=str(r.get("vehicle", "") or ""),
            account=str(r.get("account", "") or ""),
            source=str(r.get("source", "") or ""),
        ))
    return out


def _clusters(recs: List[Any]) -> List[Any]:
    """Union-find clustering over AUTO_MERGE decisions. Prefer the repo's own
    build_unified_entities; fall back to an equivalent local union-find if
    unified_entity failed to import (e.g. its optional deps)."""
    if _ue is not None:
        return _ue.build_unified_entities(recs)

    # Local equivalent of build_unified_entities, AUTO_MERGE only.
    parent = {r.record_id: r.record_id for r in recs}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    pw = _er.deduplicate(recs)
    for m in pw["auto_merge"]:
        union(m.record_a, m.record_b)

    groups: Dict[str, List[Any]] = {}
    for r in recs:
        groups.setdefault(find(r.record_id), []).append(r)

    class _U:  # duck-types UnifiedEntity for the mapper below
        __slots__ = ("member_record_ids", "canonical_name", "sources", "confidence")

    out = []
    for members in groups.values():
        u = _U()
        u.member_record_ids = [m.record_id for m in members]
        u.canonical_name = max((m.name for m in members if m.name),
                               key=len, default="")
        u.sources = {m.source for m in members if m.source}
        u.confidence = 1.0
        out.append(u)
    return out


def _reasons(result: Any, ra: Any, rb: Any) -> List[str]:
    """Turn the resolver's terse reasons into the plain-English lines the
    officer sees, and always state why it is asking rather than merging."""
    lines = [f"{ra.name!r} and {rb.name!r} scored {result.score:.2f} on the "
             f"resolver's combined name/phone/address/account match."]
    for r in result.reasons:
        if r and r != "no strong signals":
            lines.append(r)
    lines.append(f"It merges on its own only at or above "
                 f"{_er.AUTO_MERGE_THRESHOLD:.2f}. This is below that, so it "
                 f"waits for you.")
    return lines


def deduplicate(records: List[Dict]) -> Dict[str, Any]:
    """The one function tools.resolve_entities calls on the resolver.

    Returns the agent's shape: clustered `entities`, uncertain `flagged` pairs
    carrying the resolver's own reasons, and `stats`. Built entirely on the
    real nlp/ resolver — the clustering that keeps two same-named strangers
    apart is CaseFlow's, not a stub's.
    """
    _load()
    recs = _to_records(records)
    by_id = {r.record_id: r for r in recs}

    clusters = _clusters(recs)
    entities: List[Dict[str, Any]] = []
    recid_to_ent: Dict[str, str] = {}
    for i, u in enumerate(clusters, 1):
        members = [by_id[m] for m in u.member_record_ids]
        variants = list(dict.fromkeys(m.name for m in members if m.name))
        ent_id = f"ENT{i:05d}"
        for m in u.member_record_ids:
            recid_to_ent[m] = ent_id
        canonical = getattr(u, "canonical_name", "") or (
            max(variants, key=len) if variants else "")
        entities.append({
            "entity_id": ent_id,
            "canonical": {"name": canonical,
                          "phone": next((m.phone for m in members if m.phone), "")},
            "variants": {"name": variants},
            "record_count": len(members),
            "member_record_ids": list(u.member_record_ids),
            "sources": sorted(getattr(u, "sources", set()) or []),
            "confidence": round(float(getattr(u, "confidence", 1.0)), 2),
        })

    # Uncertain pairs (FLAG_FOR_REVIEW, 0.70-0.89) become approval requests —
    # but only when the two records landed in different clusters, since a pair
    # already merged has nothing left to ask about.
    pw = _er.deduplicate(recs)
    flagged: List[Dict[str, Any]] = []
    seen = set()
    for m in pw["flagged"]:
        ea = recid_to_ent.get(m.record_a)
        eb = recid_to_ent.get(m.record_b)
        if not ea or not eb or ea == eb:
            continue
        key = tuple(sorted((ea, eb)))
        if key in seen:
            continue
        seen.add(key)
        ra, rb = by_id[m.record_a], by_id[m.record_b]
        flagged.append({
            "entities_to_merge": [ea, eb],
            "confidence": round(float(m.score), 2),
            "reasons": _reasons(m, ra, rb),
            "preview": {"a": {"name": ra.name, "source": ra.source},
                        "b": {"name": rb.name, "source": rb.source}},
        })

    return {
        "entities": entities,
        "flagged": flagged,
        "stats": {
            "input_records": len(records),
            "unique_entities": len(entities),
            "flagged_for_review": len(flagged),
            "mode": "caseflow_nlp_resolver",
        },
    }
