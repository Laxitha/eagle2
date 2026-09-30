"""
Builds the Neo4j knowledge graph: nodes (Person, Phone, Vehicle, Case,
Account, Location, Org) and relationships (CALLED, OWNED, VISITED,
TRANSFERRED, ...) carrying metadata (source, confidence, timestamp).
"""
from app.db.neo4j_client import run_query

NODE_LABELS = {"Person", "Phone", "Vehicle", "Case", "Account", "Location", "Org"}
RELATIONSHIP_TYPES = {"CALLED", "CONTACTED", "OWNED", "VISITED", "TRANSFERRED", "LINKED_TO"}


def ensure_constraints():
    """Uniqueness constraints so re-ingesting the same entity is idempotent."""
    for label in NODE_LABELS:
        run_query(f"CREATE CONSTRAINT IF NOT EXISTS FOR (n:{label}) REQUIRE n.id IS UNIQUE")


def upsert_node(label: str, node_id: str, properties: dict) -> dict:
    if label not in NODE_LABELS:
        raise ValueError(f"unknown node label: {label}")
    query = f"""
    MERGE (n:{label} {{id: $node_id}})
    SET n += $properties
    RETURN n
    """
    result = run_query(query, {"node_id": node_id, "properties": properties})
    return result[0]["n"] if result else {}


def upsert_relationship(
    from_label: str, from_id: str,
    to_label: str, to_id: str,
    rel_type: str,
    source: str, confidence: float, timestamp: str | None = None,
    extra: dict | None = None,
) -> dict:
    if rel_type not in RELATIONSHIP_TYPES:
        raise ValueError(f"unknown relationship type: {rel_type}")
    props = {"source": source, "confidence": confidence, "timestamp": timestamp}
    if extra:
        props.update(extra)

    query = f"""
    MATCH (a:{from_label} {{id: $from_id}}), (b:{to_label} {{id: $to_id}})
    MERGE (a)-[r:{rel_type}]->(b)
    SET r += $props
    RETURN elementId(r) AS relationship_id, r
    """
    result = run_query(query, {"from_id": from_id, "to_id": to_id, "props": props})
    return result[0] if result else {}


def ingest_resolved_entities(unified_entities: list[dict]) -> int:
    """Consumes Laxitha's /api/resolve output: creates one Person node per
    unified entity, using the unified_id as the graph node id."""
    count = 0
    for ent in unified_entities:
        upsert_node("Person", ent["unified_id"], {
            "name": ent["canonical_name"],
            "sources": list(ent.get("sources", [])),
        })
        count += 1
    return count
