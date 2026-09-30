"""
trace.py — the append-only record of everything the agent did.

This is not logging. It is a required submission artefact: "a trace, failures
included". Two properties matter and both are deliberate:

  * append-only — nothing is ever edited or removed, so a failure that was
    later recovered from still appears
  * written to disk as JSONL as well as held in memory, so a crashed run still
    leaves its evidence behind
"""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Dict, List, Optional

from .contracts import TraceEvent

TRACE_DIR = Path(os.getenv("CASEFLOW_TRACE_DIR", "traces"))
_LOCK = threading.Lock()
_MEM: Dict[str, List[TraceEvent]] = {}


def _path(run_id: str) -> Path:
    TRACE_DIR.mkdir(parents=True, exist_ok=True)
    return TRACE_DIR / f"{run_id}.jsonl"


def record(run_id: str, kind: str, message: str,
           step_id: Optional[str] = None, **data) -> TraceEvent:
    """Append one event. Never raises — a broken trace must not kill a run."""
    ev = TraceEvent(run_id=run_id, kind=kind, message=message,
                    step_id=step_id, data=data)
    with _LOCK:
        _MEM.setdefault(run_id, []).append(ev)
        try:
            with open(_path(run_id), "a", encoding="utf-8") as f:
                f.write(json.dumps(ev.to_dict(), ensure_ascii=False,
                                   default=str) + "\n")
        except Exception:
            pass
    return ev


def events(run_id: str) -> List[Dict]:
    with _LOCK:
        return [e.to_dict() for e in _MEM.get(run_id, [])]


def as_text(run_id: str) -> str:
    """Human-readable trace. This is what goes in the submission and what the
    trace viewer renders."""
    out = []
    evs = _MEM.get(run_id, [])
    if not evs:
        return f"(no trace for {run_id})"
    t0 = evs[0].at
    marks = {
        "failure": "FAIL",
        "recovery": "RCVR",
        "recovered": "SAVE",
        "approval_requested": "ASK ",
        "approval_granted": "OK  ",
        "approval_denied": "NO  ",
        "finish": "END ",
    }
    for e in evs:
        mark = marks.get(e.kind, "    ")
        out.append(f"[{e.at - t0:7.2f}s] {mark} {e.kind:<20} {e.message}")
    return "\n".join(out)


def summarise(run_id: str) -> Dict:
    """Counts the numbers the eval harness reports."""
    evs = _MEM.get(run_id, [])
    kinds = [e.kind for e in evs]
    return {
        "events": len(evs),
        "tool_calls": kinds.count("tool_call"),
        "failures": kinds.count("failure"),
        # An *attempt* to recover is not a recovery. "recovery" events narrate
        # what the agent tried; "recovered" is only written when a replacement
        # step actually produced what the failed one could not. The eval
        # harness reports the second number, so the rate cannot be inflated by
        # trying harder and still failing.
        "recovery_attempts": kinds.count("recovery"),
        "recoveries": kinds.count("recovered"),
        "approvals_requested": kinds.count("approval_requested"),
        "approvals_granted": kinds.count("approval_granted"),
        "approvals_denied": kinds.count("approval_denied"),
    }
