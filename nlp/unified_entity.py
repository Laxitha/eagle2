"""
CaseFlow — Cross-source entity resolution (Day 3).

Builds unified entity IDs across sources (FIR reports, CDR, financial,
vehicle records) by union-find over resolve_entities() decisions, and adds
semantic-similarity as a fallback signal via sentence-transformers embeddings
for cases where names/phones are too sparse for exact/fuzzy matching alone
(e.g. matching a person mentioned only by role/context in a report).
"""
from dataclasses import dataclass, field

from entity_resolver import EntityRecord, deduplicate

_MODEL = None


def _get_model():
    """Lazy-load sentence-transformers model — avoids the import/download
    cost for callers that only need name/phone/account resolution."""
    global _MODEL
    if _MODEL is None:
        from sentence_transformers import SentenceTransformer
        _MODEL = SentenceTransformer("all-MiniLM-L6-v2")
    return _MODEL


def semantic_similarity(text1: str, text2: str) -> float:
    """Cosine similarity between sentence embeddings of two free-text
    mentions (e.g. two report snippets describing a person). 0.0-1.0."""
    if not text1 or not text2:
        return 0.0
    model = _get_model()
    embeddings = model.encode([text1, text2], normalize_embeddings=True)
    return float(embeddings[0] @ embeddings[1])


@dataclass
class UnifiedEntity:
    unified_id: str
    canonical_name: str
    member_record_ids: list = field(default_factory=list)
    sources: set = field(default_factory=set)
    confidence: float = 1.0


class _UnionFind:
    def __init__(self, ids):
        self.parent = {i: i for i in ids}

    def find(self, x):
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[ra] = rb


def build_unified_entities(records: list[EntityRecord]) -> list[UnifiedEntity]:
    """Cross-source dedup: groups records into unified entities using
    resolve_entities() AUTO_MERGE decisions (union-find over pairwise
    matches), so the same person appearing in an FIR report, a CDR file,
    and a financial record collapses to one node for the knowledge graph."""
    results = deduplicate(records)
    uf = _UnionFind([r.record_id for r in records])

    for match in results["auto_merge"]:
        uf.union(match.record_a, match.record_b)

    by_id = {r.record_id: r for r in records}
    groups: dict = {}
    for r in records:
        root = uf.find(r.record_id)
        groups.setdefault(root, []).append(r)

    unified = []
    for i, (root, members) in enumerate(groups.items(), start=1):
        # canonical name = longest (most complete) name among members
        canonical = max((m.name for m in members if m.name), key=len, default="")
        unified.append(UnifiedEntity(
            unified_id=f"UENT-{i:04d}",
            canonical_name=canonical,
            member_record_ids=[m.record_id for m in members],
            sources={m.source for m in members if m.source},
            confidence=1.0 if len(members) > 1 else 1.0,
        ))
    return unified


def to_navin_format(match_results: dict) -> list[dict]:
    """Formats resolver output for the frontend merge/verification UI:
    {entities_to_merge, confidence, reasons} per Navin's API spec."""
    out = []
    for bucket in ("auto_merge", "flagged"):
        for m in match_results[bucket]:
            out.append({
                "entities_to_merge": [m.record_a, m.record_b],
                "confidence": m.score,
                "reasons": m.reasons,
                "status": "auto_merged" if bucket == "auto_merge" else "pending_review",
            })
    return out
