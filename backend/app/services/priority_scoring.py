"""
Priority Score: weighted composite of network centrality, cross-case
presence, evidence strength, temporal recency, connection diversity, and
anomaly signals — surfaces which entities investigators should look at
first.
"""
from datetime import datetime

from app.db.neo4j_client import run_query
from app.services.graph_analytics import degree_centrality, pagerank

WEIGHTS = {
    "network": 0.25,
    "cross_case": 0.20,
    "evidence": 0.20,
    "temporal": 0.15,
    "diversity": 0.10,
    "anomaly": 0.10,
}


def _cross_case_score(entity_id: str) -> float:
    query = """
    MATCH (n {id: $entity_id})-[*1..2]-(c:Case)
    RETURN count(DISTINCT c) AS case_count
    """
    result = run_query(query, {"entity_id": entity_id})
    case_count = result[0]["case_count"] if result else 0
    return min(case_count / 3.0, 1.0)  # 3+ cases = max score


def _evidence_score(entity_id: str) -> float:
    query = """
    MATCH (n {id: $entity_id})-[r]-()
    RETURN avg(coalesce(r.confidence, 0.5)) AS avg_confidence
    """
    result = run_query(query, {"entity_id": entity_id})
    return result[0]["avg_confidence"] or 0.0 if result else 0.0


def _temporal_score(entity_id: str) -> float:
    query = """
    MATCH (n {id: $entity_id})-[r]-()
    WHERE r.timestamp IS NOT NULL
    RETURN max(r.timestamp) AS latest
    """
    result = run_query(query, {"entity_id": entity_id})
    latest = result[0]["latest"] if result else None
    if not latest:
        return 0.0
    try:
        latest_dt = datetime.fromisoformat(str(latest))
    except ValueError:
        return 0.0
    days_ago = (datetime.utcnow() - latest_dt).days
    return max(0.0, 1.0 - days_ago / 90.0)  # linear decay over 90 days


def _diversity_score(entity_id: str) -> float:
    query = """
    MATCH (n {id: $entity_id})-[r]-()
    RETURN count(DISTINCT type(r)) AS rel_type_count
    """
    result = run_query(query, {"entity_id": entity_id})
    rel_types = result[0]["rel_type_count"] if result else 0
    return min(rel_types / 4.0, 1.0)  # 4+ distinct relation types = max score


def _anomaly_score(entity_id: str) -> float:
    """Flags unusually high-degree nodes relative to the network median as
    a cheap anomaly proxy (hubs are worth a second look)."""
    degree = degree_centrality(entity_id).get("degree", 0)
    all_degrees_query = "MATCH (n)-[r]-() RETURN n.id AS id, count(r) AS degree"
    rows = run_query(all_degrees_query)
    degrees = sorted(r["degree"] for r in rows) if rows else [0]
    median = degrees[len(degrees) // 2] if degrees else 0
    if median == 0:
        return 0.0
    ratio = degree / median
    return min(max(ratio - 1.0, 0.0) / 3.0, 1.0)  # 4x median degree = max score


def compute_priority_score(entity_id: str) -> dict:
    breakdown = {
        "network": min(degree_centrality(entity_id).get("degree", 0) / 10.0, 1.0),
        "cross_case": _cross_case_score(entity_id),
        "evidence": _evidence_score(entity_id),
        "temporal": _temporal_score(entity_id),
        "diversity": _diversity_score(entity_id),
        "anomaly": _anomaly_score(entity_id),
    }
    total = sum(breakdown[k] * WEIGHTS[k] for k in WEIGHTS)
    return {"entity_id": entity_id, "score": round(total, 4), "breakdown": breakdown}


def top_priority_entities(limit: int = 10) -> list[dict]:
    """Uses PageRank as a cheap pre-filter (top 3x candidates) before
    computing the full weighted score, so this doesn't scan every node."""
    ranked = pagerank()[: limit * 3]
    scored = [compute_priority_score(row["entity_id"]) for row in ranked]
    scored.sort(key=lambda s: s["score"], reverse=True)
    return scored[:limit]
