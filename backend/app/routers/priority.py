from fastapi import APIRouter, Depends, Query

from app.dependencies import get_current_user
from app.services.priority_scoring import compute_priority_score, top_priority_entities

router = APIRouter(prefix="/api/priority", tags=["priority"])


# Registered before /{entity_id} so the literal path "top" isn't swallowed
# by the path parameter.
@router.get("/top")
def top_priority(limit: int = Query(10, le=100), user=Depends(get_current_user)):
    return {"entities": top_priority_entities(limit)}


@router.get("/{entity_id}")
def priority_for_entity(entity_id: str, user=Depends(get_current_user)):
    return compute_priority_score(entity_id)
