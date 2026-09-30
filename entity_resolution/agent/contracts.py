"""
contracts.py — the shapes everything else agrees on.

Nothing here imports Neo4j, FastAPI or an LLM. Keeping the vocabulary in one
dependency-free file is what lets the planner, the tools, the gate and the
trace be written by different people without colliding.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any, Dict, List, Optional


def _id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def now() -> float:
    return time.time()


# ---------------------------------------------------------------- risk tiers

class Risk(str, Enum):
    """How much trouble a tool can cause. This is the human approval line.

    AUTO    nothing outside the agent's own working memory changes.
    ASK     writes into the case record, or an identity decision the resolver
            is not confident about. A person rules on it.
    ALWAYS  leaves the building and cannot be taken back.
    """
    AUTO = "auto"
    ASK = "ask"
    ALWAYS_ASK = "always_ask"


class StepStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
    RECOVERED = "recovered"
    AWAITING_APPROVAL = "awaiting_approval"
    REJECTED = "rejected"
    SKIPPED = "skipped"


class RunStatus(str, Enum):
    RUNNING = "running"
    AWAITING_APPROVAL = "awaiting_approval"
    COMPLETED = "completed"
    FAILED = "failed"
    ABORTED = "aborted"


# ---------------------------------------------------------------- tool layer

@dataclass
class ToolResult:
    """What every tool returns. `ok=False` is a normal outcome, not a crash —
    the checker reads it and decides whether to recover."""
    ok: bool
    data: Any = None
    # Why it failed, in words an investigator could read.
    error: Optional[str] = None
    # Machine-readable reason, so the recovery logic can branch on it.
    # e.g. "no_results", "ambiguous_identity", "source_unavailable"
    reason_code: Optional[str] = None
    # Anything the agent should remember for later steps.
    facts: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self):
        return asdict(self)


@dataclass
class ToolSpec:
    name: str
    description: str
    risk: Risk
    # JSON-schema-ish: {"arg": "what it is"} — enough for an LLM to fill in.
    args: Dict[str, str] = field(default_factory=dict)

    def to_dict(self):
        d = asdict(self)
        d["risk"] = self.risk.value
        return d


# ---------------------------------------------------------------- plan/steps

@dataclass
class Step:
    tool: str
    args: Dict[str, Any] = field(default_factory=dict)
    # Why the planner chose this step. Shown in the trace.
    intent: str = ""
    id: str = field(default_factory=lambda: _id("step"))
    status: StepStatus = StepStatus.PENDING
    result: Optional[Dict[str, Any]] = None
    attempts: int = 0
    # Set when this step exists because an earlier one failed.
    recovers: Optional[str] = None
    # How many recovery hops produced this step. A retry may not itself be
    # retried — without this the loop spawns retries of retries forever.
    depth: int = 0

    def to_dict(self):
        d = asdict(self)
        d["status"] = self.status.value
        return d


@dataclass
class Plan:
    goal: str
    steps: List[Step] = field(default_factory=list)
    id: str = field(default_factory=lambda: _id("plan"))
    # Where the plan came from: "llm" or "fallback".
    source: str = "llm"

    def to_dict(self):
        return {"id": self.id, "goal": self.goal, "source": self.source,
                "steps": [s.to_dict() for s in self.steps]}


# ---------------------------------------------------------------- approvals

@dataclass
class ApprovalRequest:
    """What the officer is being asked to rule on.

    `reasons` is written to be shown verbatim. Not a score — a sentence.
    """
    run_id: str
    step_id: str
    tool: str
    summary: str
    reasons: List[str] = field(default_factory=list)
    preview: Dict[str, Any] = field(default_factory=dict)
    risk: Risk = Risk.ASK
    confidence: Optional[float] = None
    id: str = field(default_factory=lambda: _id("apr"))
    created_at: float = field(default_factory=now)
    decided: Optional[bool] = None
    decided_at: Optional[float] = None
    decided_by: Optional[str] = None
    note: Optional[str] = None

    def to_dict(self):
        d = asdict(self)
        d["risk"] = self.risk.value
        return d


# ---------------------------------------------------------------- trace

@dataclass
class TraceEvent:
    run_id: str
    kind: str          # goal | plan | step_start | tool_call | tool_result |
                       # failure | recovery | approval_requested |
                       # approval_granted | approval_denied | finish
    message: str
    at: float = field(default_factory=now)
    data: Dict[str, Any] = field(default_factory=dict)
    step_id: Optional[str] = None

    def to_dict(self):
        return asdict(self)


@dataclass
class Run:
    goal: str
    id: str = field(default_factory=lambda: _id("run"))
    status: RunStatus = RunStatus.RUNNING
    case_id: Optional[str] = None
    plan: Optional[Plan] = None
    started_at: float = field(default_factory=now)
    finished_at: Optional[float] = None
    # Accumulated knowledge across steps — what the checker checks against.
    state: Dict[str, Any] = field(default_factory=dict)
    pending_approval: Optional[ApprovalRequest] = None
    summary: Optional[str] = None

    def elapsed(self) -> float:
        return (self.finished_at or now()) - self.started_at

    def to_dict(self):
        return {
            "id": self.id,
            "goal": self.goal,
            "status": self.status.value,
            "case_id": self.case_id,
            "plan": self.plan.to_dict() if self.plan else None,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "elapsed_seconds": round(self.elapsed(), 2),
            "state": self.state,
            "pending_approval": (self.pending_approval.to_dict()
                                 if self.pending_approval else None),
            "summary": self.summary,
        }
