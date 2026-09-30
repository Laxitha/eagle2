"""
Vercel service entry point — wraps the NLP extraction pipeline as a
FastAPI app so it can be called over HTTP by the backend service.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ner_pipeline import extract_entities
from relation_extractor import extract_relations

app = FastAPI(title="CaseFlow NLP", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExtractRequest(BaseModel):
    text: str


@app.get("/health")
def health():
    return {"status": "ok", "service": "nlp"}


@app.post("/extract")
def extract(payload: ExtractRequest):
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
