"""
agent_api.py — the HTTP surface, as a router.

A router rather than an app, so it mounts into the graph API already running
on :8001 with one line and the frontend keeps talking to a single origin:

    from entity_resolution.agent.agent_api import router as agent_router
    app.include_router(agent_router)

Everything the demo UI needs is here and nothing else:

    POST /agent/run                start a run
    GET  /agent/runs               list runs
    GET  /agent/runs/{id}          one run, with its plan and state
    GET  /agent/runs/{id}/trace    the trace — JSON, or text for the viewer
    GET  /agent/approvals          what is waiting for an officer
    POST /agent/approvals/{id}     the officer's decision
    GET  /agent/tools              the tool list with its risk tier

The trace endpoint is not a debug route. "A trace, failures included" is a
required part of the submission, so it is a first-class endpoint.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from . import agent, approval, trace, tools

router = APIRouter(prefix="/agent", tags=["agent"])


# ---------------------------------------------------------------- schemas

class RunRequest(BaseModel):
    goal: str = Field(..., description="What the officer wants done, in words.",
                      examples=["Map the network around Suresh Nair in "
                                "CASE-104 and find the connector"])
    case_id: Optional[str] = Field(None, examples=["CASE-104"])
    # Only the eval harness sets this. It can never approve an ALWAYS_ASK tool.
    auto_approve: bool = False


class DecisionRequest(BaseModel):
    approved: bool
    by: str = "officer"
    note: Optional[str] = None


# ---------------------------------------------------------------- endpoints

@router.post("/run")
def start_run(req: RunRequest) -> Dict[str, Any]:
    """Run a goal to completion, or until it needs an officer.

    Synchronous on purpose: a demo run is under a second, and a pending
    approval is a returned state rather than something to poll for.
    """
    run = agent.run_goal(req.goal, case_id=req.case_id,
                         auto_approve=req.auto_approve)
    return {
        "run": run.to_dict(),
        "awaiting_approval": run.status.value == "awaiting_approval",
        "approvals": approval.pending(run.id),
        "trace_summary": trace.summarise(run.id),
    }


@router.get("/runs")
def list_runs() -> Dict[str, Any]:
    runs = agent.all_runs()
    return {"runs": runs, "total": len(runs)}


@router.get("/runs/{run_id}")
def get_run(run_id: str) -> Dict[str, Any]:
    run = agent.get_run(run_id)
    if run is None:
        raise HTTPException(404, f"no run {run_id}")
    return {
        "run": run.to_dict(),
        "approvals": approval.pending(run_id),
        "decided": approval.history(run_id),
        "trace_summary": trace.summarise(run_id),
    }


@router.get("/runs/{run_id}/trace")
def get_trace(run_id: str,
              fmt: str = Query("json", pattern="^(json|text)$")) -> Dict[str, Any]:
    """`fmt=text` returns the readable trace — the one that goes in the
    submission and renders in the viewer."""
    evs = trace.events(run_id)
    if not evs:
        raise HTTPException(404, f"no trace for {run_id}")
    if fmt == "text":
        return {"run_id": run_id, "text": trace.as_text(run_id),
                "summary": trace.summarise(run_id)}
    return {"run_id": run_id, "events": evs,
            "summary": trace.summarise(run_id)}


@router.get("/approvals")
def list_approvals(run_id: Optional[str] = None) -> Dict[str, Any]:
    """The officer's queue, most confident first — so the easy calls clear
    fast and attention goes to the genuinely doubtful ones."""
    items = approval.pending(run_id)
    return {"queue": items, "total": len(items)}


@router.post("/approvals/{approval_id}")
def decide(approval_id: str, req: DecisionRequest) -> Dict[str, Any]:
    pend = approval.get(approval_id)
    if pend is None:
        raise HTTPException(404, f"no approval {approval_id}")
    if pend.decided is not None:
        raise HTTPException(409, "already decided")

    run = agent.resume(pend.run_id, approval_id, req.approved, by=req.by)
    if run is None:
        raise HTTPException(404, f"no run {pend.run_id}")
    return {
        "run": run.to_dict(),
        "approvals": approval.pending(run.id),
        "trace_summary": trace.summarise(run.id),
    }


# ---------------------------------------------------------------- chat

class ChatRequest(BaseModel):
    message: str
    case_id: Optional[str] = None


_GREETING = re.compile(r"^\s*(hi|hii+|hey+|hello|hola|yo|namaste|good\s*(morning|afternoon|evening)|"
                       r"greetings|sup|what'?s\s*up)\b", re.I)
_THANKS = re.compile(r"\b(thanks|thank you|thx|ty|appreciate)\b", re.I)
_HELP = re.compile(r"\b(help|what can you do|how do you work|what do you do|capabilit|who are you|"
                   r"what are you)\b", re.I)
_GOAL_HINT = re.compile(r"\b(map|network|connector|resolve|find|trace|link|who|graph|"
                        r"investigat|draft|report|email|case)\b", re.I)
_CASE_RE = re.compile(r"case[-\s]?\d+|fir[-\s/]?\S+", re.I)


def _capabilities() -> str:
    return ("I'm the CaseFlow investigation agent. Give me a person and a case and I'll do the "
            "legwork: pull the call, financial and vehicle records, work out which entries are the "
            "same person written differently, build the network, and point out who connects the "
            "most. I stop and ask you before writing to a case record or sending anything.\n\n"
            "Try: “Map the network around Suresh Nair in CASE-104 and find the connector”.")


def _summarise_run(payload: Dict[str, Any]) -> str:
    run = payload["run"]
    st = run.get("state", {})
    ts = payload["trace_summary"]
    people = st.get("entities", [])
    connector = st.get("connector", "")
    bits = []
    if run.get("case_id"):
        bits.append(f"I worked {run['case_id']}.")
    if people:
        bits.append(f"I resolved {len(people)} " + ("person" if len(people) == 1 else "people") + ".")
    if ts.get("recoveries"):
        bits.append(f"{ts['recoveries']} record(s) would have been missed under a different "
                    f"spelling — I recovered them.")
    if connector:
        bits.append(f"The connector — the person tying the most together — is {connector}.")
    if payload.get("awaiting_approval"):
        bits.append("There's something waiting for your approval on the right before I go further.")
    elif not people:
        bits.append("I couldn't find anyone matching that in the sources.")
    return " ".join(bits) or run.get("summary", "Done.")


@router.post("/chat")
def chat(req: ChatRequest) -> Dict[str, Any]:
    """Conversational front door. Answers over the UPLOADED case store only —
    no sample data. Thanks get a quick reply; everything else is handled by the
    store-aware agent, which reads the resolved people and the graph."""
    msg = (req.message or "").strip()
    if not msg:
        return {"kind": "chat", "reply": "Ask me about the case files you've uploaded — "
                "who connects to whom, or who the key figure is."}
    if _THANKS.search(msg) and len(msg.split()) <= 4:
        return {"kind": "chat", "reply": "Anytime. Ask me anything else about the data."}
    from . import webagent
    return webagent.answer(msg)


@router.get("/tools")
def list_tools() -> Dict[str, Any]:
    """Every tool with its risk tier. This is the approval policy, readable —
    the answer to "what does it do on its own and what does it ask about"
    comes from the running system, not from a slide."""
    specs = tools.specs()
    return {
        "tools": specs,
        "tiers": {
            "auto": "Runs on its own. Nothing outside the agent's working "
                    "memory changes.",
            "ask": "An officer rules on it. Writes into the case record, or "
                   "an identity match between 0.70 and 0.89.",
            "always_ask": "Always an officer, with no exception. It leaves "
                          "the building and cannot be taken back.",
        },
        "counts": {t: sum(1 for s in specs if s["risk"] == t)
                   for t in ("auto", "ask", "always_ask")},
    }
