from fastapi import APIRouter, Depends, Query

from app.dependencies import get_current_user
from app.services import graph_analytics

router = APIRouter(prefix="/api/graph", tags=["graph"])


@router.get("/centrality/{entity_id}")
def centrality(entity_id: str, user=Depends(get_current_user)):
    return graph_analytics.degree_centrality(entity_id)


@router.get("/community-detection")
def community_detection(user=Depends(get_current_user)):
    return {"communities": graph_analytics.community_detection()}


@router.get("/shortest-path")
def shortest_path(from_: str = Query(alias="from"), to: str = Query(...), user=Depends(get_current_user)):
    return graph_analytics.shortest_path(from_, to)


@router.get("/pagerank")
def pagerank(user=Depends(get_current_user)):
    return {"ranked": graph_analytics.pagerank()}
