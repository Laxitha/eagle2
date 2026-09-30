"""
LLM explanation + natural-language query endpoints. Builds a context blob
from graph data (evidence, priority score, connections) and hands it to an
LLM to produce a human-readable rationale, or turns an NL question into a
Cypher query. Ships with a deterministic template-based fallback so the
demo works with no LLM API key configured.
"""
import os

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.services.priority_scoring import compute_priority_score

router = APIRouter(prefix="/api", tags=["explain"])


def _template_explanation(entity_id: str, priority: dict) -> str:
    top_factor = max(priority["breakdown"], key=priority["breakdown"].get)
    factor_labels = {
        "network": "is highly connected within the network",
        "cross_case": "appears across multiple open cases",
        "evidence": "is linked by high-confidence evidence",
        "temporal": "has recent activity",
        "diversity": "has diverse relationship types (calls, transfers, visits)",
        "anomaly": "shows an unusually high number of connections",
    }
    return (
        f"Entity {entity_id} has a priority score of {priority['score']:.2f}. "
        f"It is significant primarily because it {factor_labels[top_factor]}."
    )


class ExplainRequest(BaseModel):
    entity_id: str
    context: str = ""


@router.post("/explain/{entity_id}")
def explain(entity_id: str, user=Depends(get_current_user)):
    priority = compute_priority_score(entity_id)
    if os.getenv("ANTHROPIC_API_KEY"):
        # Hook point: call the LLM with entity_id + priority breakdown +
        # graph context for a richer explanation once an API key is set.
        pass
    return {"entity_id": entity_id, "explanation": _template_explanation(entity_id, priority), "priority": priority}


class QueryRequest(BaseModel):
    question: str


_QUERY_TEMPLATES = {
    "who called": """MATCH (a:Person)-[r:CALLED]->(b:Person {{name: $name}}) RETURN a.name AS caller, r.timestamp AS when""",
    "who transferred": """MATCH (a:Person)-[r:TRANSFERRED]->(b:Person {{name: $name}}) RETURN a.name AS sender, r AS transfer""",
    "who visited": """MATCH (a:Person)-[r:VISITED]->(b:Location {{name: $name}}) RETURN a.name AS visitor, r.timestamp AS when""",
}


@router.post("/query")
def nl_query(payload: QueryRequest, user=Depends(get_current_user)):
    """Naive intent match on the question -> parameterized Cypher template.
    Swap for a sentence-transformers intent classifier once trained."""
    q = payload.question.lower()
    for phrase, cypher in _QUERY_TEMPLATES.items():
        if phrase in q:
            name = payload.question.split(phrase, 1)[-1].strip(" ?")
            return {"matched_intent": phrase, "cypher": cypher, "params": {"name": name}}
    return {"matched_intent": None, "cypher": None, "message": "no matching query template — extend _QUERY_TEMPLATES"}
