from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.services import nlp_bridge  # noqa: F401  (sets up sys.path for nlp/ import below)

from entity_resolver import EntityRecord
from unified_entity import build_unified_entities, to_navin_format

router = APIRouter(prefix="/api/resolve", tags=["resolve"])


class RecordIn(BaseModel):
    record_id: str
    name: str = ""
    phone: str = ""
    address: str = ""
    vehicle: str = ""
    account: str = ""
    source: str = ""


class ResolveRequest(BaseModel):
    records: list[RecordIn]


@router.post("")
def resolve(payload: ResolveRequest, user=Depends(get_current_user)):
    """Laxitha's entity resolution API. Input: raw records from multiple
    sources. Output: unified entities (for Sivakesav's graph ingestion) and
    the merge/flag list in Navin's {entities_to_merge, confidence, reasons}
    format for the frontend verification UI."""
    records = [EntityRecord(**r.dict()) for r in payload.records]
    unified = build_unified_entities(records)

    from entity_resolver import deduplicate
    match_results = deduplicate(records)

    return {
        "unified_entities": [
            {
                "unified_id": u.unified_id,
                "canonical_name": u.canonical_name,
                "member_record_ids": u.member_record_ids,
                "sources": list(u.sources),
                "confidence": u.confidence,
            }
            for u in unified
        ],
        "merge_candidates": to_navin_format(match_results),
    }
