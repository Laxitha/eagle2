"""
approval.py — the human approval line.

The submission has to answer: which decisions does the system take alone,
which go to a person, and *why*. That answer lives here, in one file, as code
rather than as a claim on a slide.

Three tiers:

  AUTO        reading a source, resolving an identity at >= 0.90, building the
              graph, retrying a failed search. Nothing outside the agent's own
              working memory changes.

  ASK         a merge scoring 0.70-0.89, or writing findings into the case
              record. A wrong merge here puts an innocent person inside a case
              file, and anything written into the record is what the next
              officer acts on.

  ALWAYS_ASK  anything that leaves the building. It cannot be taken back and a
              person receives it.

`AUTO_APPROVE_ALL=1` exists only for the eval harness, which runs unattended.
It is refused when the tool is ALWAYS_ASK, so an unattended run can never send
an email.
"""

from __future__ import annotations

import os
import threading
from typing import Callable, Dict, List, Optional

from .contracts import ApprovalRequest, Risk

_LOCK = threading.Lock()
_PENDING: Dict[str, ApprovalRequest] = {}
_DECIDED: Dict[str, ApprovalRequest] = {}

# Set by the eval harness. Never honoured for ALWAYS_ASK.
AUTO_APPROVE = os.getenv("CASEFLOW_AUTO_APPROVE", "0") == "1"


def resolution_tier(confidence: float) -> Risk:
    """The identity-resolution thresholds, reused verbatim from the resolver.

    >= 0.90  the agent merges on its own
    0.70-0.89 a person rules on it
    <  0.70  not a match; nothing to approve
    """
    if confidence >= 0.90:
        return Risk.AUTO
    if confidence >= 0.70:
        return Risk.ASK
    return Risk.AUTO          # below threshold it simply isn't merged


def request(run_id: str, step_id: str, tool: str, summary: str,
            reasons: Optional[List[str]] = None,
            preview: Optional[Dict] = None,
            risk: Risk = Risk.ASK,
            confidence: Optional[float] = None) -> ApprovalRequest:
    req = ApprovalRequest(
        run_id=run_id, step_id=step_id, tool=tool, summary=summary,
        reasons=reasons or [], preview=preview or {}, risk=risk,
        confidence=confidence,
    )
    with _LOCK:
        _PENDING[req.id] = req
    return req


def auto_decide(req: ApprovalRequest) -> Optional[bool]:
    """Used only by the unattended eval harness. Returns None if a human is
    genuinely required."""
    if not AUTO_APPROVE:
        return None
    if req.risk is Risk.ALWAYS_ASK:
        return None           # never auto-approved, not even in eval
    return True


def decide(approval_id: str, approved: bool, by: str = "officer",
           note: Optional[str] = None) -> Optional[ApprovalRequest]:
    with _LOCK:
        req = _PENDING.pop(approval_id, None)
        if req is None:
            return None
        req.decided = approved
        req.decided_by = by
        req.note = note
        from .contracts import now
        req.decided_at = now()
        _DECIDED[approval_id] = req
        return req


def pending(run_id: Optional[str] = None) -> List[Dict]:
    with _LOCK:
        items = list(_PENDING.values())
    if run_id:
        items = [r for r in items if r.run_id == run_id]
    items.sort(key=lambda r: -(r.confidence or 0))
    return [r.to_dict() for r in items]


def get(approval_id: str) -> Optional[ApprovalRequest]:
    with _LOCK:
        return _PENDING.get(approval_id) or _DECIDED.get(approval_id)


def history(run_id: Optional[str] = None) -> List[Dict]:
    with _LOCK:
        items = list(_DECIDED.values())
    if run_id:
        items = [r for r in items if r.run_id == run_id]
    items.sort(key=lambda r: r.decided_at or 0)
    return [r.to_dict() for r in items]
