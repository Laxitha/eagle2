from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.postgres import get_db
from app.dependencies import get_current_user
from app.models.tables import Lead, User
from app.services.priority_scoring import top_priority_entities

router = APIRouter(prefix="/api/leads", tags=["leads"])


class VerifyRequest(BaseModel):
    approved: bool
    notes: str = ""


def _recommend_action(breakdown: dict) -> str:
    top_factor = max(breakdown, key=breakdown.get)
    return {
        "network": "Investigate immediate contacts — this entity is a network hub.",
        "cross_case": "Cross-reference open cases — this entity appears in multiple investigations.",
        "evidence": "High-confidence evidence trail — prioritize for formal action.",
        "temporal": "Recent activity detected — time-sensitive, act promptly.",
        "diversity": "Multiple relationship types — possible coordinator role.",
        "anomaly": "Unusual connectivity pattern — verify for anomalous behavior.",
    }[top_factor]


@router.post("/generate")
def generate_leads(limit: int = 10, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    scored = top_priority_entities(limit)
    created = []
    for s in scored:
        lead = Lead(
            entity_id=s["entity_id"],
            score=s["score"],
            reason=f"Priority score {s['score']:.2f} — " + ", ".join(
                f"{k}={v:.2f}" for k, v in s["breakdown"].items()
            ),
            recommended_action=_recommend_action(s["breakdown"]),
        )
        db.add(lead)
        created.append(lead)
    db.commit()
    for lead in created:
        db.refresh(lead)
    return [
        {"id": l.id, "entity_id": l.entity_id, "score": l.score, "reason": l.reason,
         "recommended_action": l.recommended_action, "status": l.status}
        for l in created
    ]


@router.patch("/{lead_id}/verify")
def verify_lead(lead_id: str, payload: VerifyRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "lead not found")
    lead.status = "verified" if payload.approved else "rejected"
    lead.verified_by = user.id
    lead.verified_at = datetime.utcnow()
    db.commit()
    db.refresh(lead)
    return {"id": lead.id, "status": lead.status, "verified_by": lead.verified_by, "verified_at": lead.verified_at}
