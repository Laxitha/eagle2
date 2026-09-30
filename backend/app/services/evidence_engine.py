"""
Evidence Engine: every relationship in the graph must be traceable to a
source. This module links Neo4j relationships to Postgres EvidenceRecord
rows and handles human verification of leads.
"""
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.tables import EvidenceRecord


def record_evidence(
    db: Session,
    relationship_id: str,
    source_type: str,
    confidence: float,
    source_document_id: str | None = None,
) -> EvidenceRecord:
    evidence = EvidenceRecord(
        relationship_id=relationship_id,
        source_document_id=source_document_id,
        source_type=source_type,
        confidence=confidence,
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)
    return evidence


def get_evidence_for_relationship(db: Session, relationship_id: str) -> list[EvidenceRecord]:
    return (
        db.query(EvidenceRecord)
        .filter(EvidenceRecord.relationship_id == relationship_id)
        .all()
    )


def verify_evidence(db: Session, evidence_id: str, user_id: str, approved: bool) -> EvidenceRecord | None:
    evidence = db.query(EvidenceRecord).filter(EvidenceRecord.id == evidence_id).first()
    if evidence is None:
        return None
    evidence.verification_status = "verified" if approved else "rejected"
    evidence.verified_by = user_id
    evidence.verified_at = datetime.utcnow()
    db.commit()
    db.refresh(evidence)
    return evidence
