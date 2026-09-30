import os
from urllib.request import urlopen, Request
import json

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.services import nlp_bridge  # noqa: F401 — sets up sys.path

router = APIRouter(prefix="/api/nlp", tags=["nlp"])

NLP_URL = os.getenv("NLP_URL")


class ExtractRequest(BaseModel):
    text: str


@router.post("/extract")
def extract(payload: ExtractRequest, user=Depends(get_current_user)):
    if NLP_URL:
        req = Request(
            f"{NLP_URL}/extract",
            data=json.dumps({"text": payload.text}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(req) as resp:
            return json.loads(resp.read())

    from ner_pipeline import extract_entities
    from relation_extractor import extract_relations

    entities = extract_entities(payload.text)
    relations = extract_relations(payload.text, entities)
    return {
        "entities": [
            {"text": e.text, "label": e.label, "start": e.start, "end": e.end, "confidence": e.confidence}
            for e in entities
        ],
        "relations": [
            {"source": r.source, "target": r.target, "type": r.type, "confidence": r.confidence, "sentence": r.sentence}
            for r in relations
        ],
        "metadata": {"entity_count": len(entities), "relation_count": len(relations)},
    }
