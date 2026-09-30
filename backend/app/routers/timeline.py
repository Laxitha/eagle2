from fastapi import APIRouter, Depends

from app.db.neo4j_client import run_query
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/timeline", tags=["timeline"])


@router.get("/{entity_id}")
def get_timeline(entity_id: str, user=Depends(get_current_user)):
    query = """
    MATCH (n {id: $entity_id})-[r]-(other)
    WHERE r.timestamp IS NOT NULL
    RETURN r.timestamp AS timestamp, type(r) AS relation_type,
           other.id AS other_id, other.name AS other_name,
           r.source AS source, r.confidence AS confidence
    ORDER BY r.timestamp ASC
    """
    events = run_query(query, {"entity_id": entity_id})
    return {"entity_id": entity_id, "events": events}
