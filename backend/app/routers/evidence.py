from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.postgres import get_db
from app.dependencies import get_current_user
from app.services.evidence_engine import get_evidence_for_relationship

router = APIRouter(prefix="/api/evidence", tags=["evidence"])


@router.get("/{relationship_id}")
def evidence_for_relationship(relationship_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    records = get_evidence_for_relationship(db, relationship_id)
    if not records:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "no evidence found for this relationship")
    return [
        {
            "id": r.id,
            "relationship_id": r.relationship_id,
            "source_type": r.source_type,
            "confidence": r.confidence,
            "verification_status": r.verification_status,
        }
        for r in records
    ]
