from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.services.graph_analytics import community_detection, pagerank
from app.services.priority_scoring import top_priority_entities

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/{case_id}")
def generate_report(case_id: str, user=Depends(get_current_user)):
    """Assembles the Intelligence Report sections (overview, network,
    timeline, evidence, leads) from live graph + priority data."""
    return {
        "case_id": case_id,
        "network_analysis": {
            "communities": community_detection(),
            "top_ranked": pagerank()[:10],
        },
        "investigative_leads": top_priority_entities(10),
        "generated_by": user.username,
    }
