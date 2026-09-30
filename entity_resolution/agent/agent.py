"""
agent.py — the loop.

    goal -> plan -> for each step: execute -> check -> (recover | continue)

Three things in here are the reason this is an agent rather than a pipeline,
and each answers a line in the problem statement:

  "plan the steps"              -> Planner produces the step list
  "check its progress"          -> _check runs after every step
  "recover when something fails"-> _recover, including the identity-aware retry
  "ask before risky actions"    -> the gate, before any ASK / ALWAYS_ASK tool

The identity-aware retry is the interesting one. A search that returns nothing
is not treated as the end: the agent asks the resolver what else that person is
called and tries again with each spelling. That only works because entity
resolution sits underneath.
"""

from __future__ import annotations

import os
import threading
from typing import Any, Dict, List, Optional

from . import approval, llm, tools, trace
from .contracts import (ApprovalRequest, Plan, Risk, Run, RunStatus, Step,
                        StepStatus, ToolResult, _id as _new_id)

MAX_RECOVERY_ATTEMPTS = int(os.getenv("CASEFLOW_MAX_RECOVERY", "3"))

_RUNS: Dict[str, Run] = {}
_LOCK = threading.Lock()


def get_run(run_id: str) -> Optional[Run]:
    with _LOCK:
        return _RUNS.get(run_id)


def all_runs() -> List[Dict]:
    with _LOCK:
        return [r.to_dict() for r in _RUNS.values()]


# ---------------------------------------------------------------- helpers

def _fill(args: Dict[str, Any], state: Dict[str, Any]) -> Dict[str, Any]:
    """Substitute {placeholders} the planner left for values only known at
    runtime — the person named in the case, the records collected so far."""
    out = {}
    for k, v in args.items():
        if isinstance(v, str) and v.startswith("{") and v.endswith("}"):
            key = v[1:-1]
            if key == "person":
                people = state.get("persons") or []
                out[k] = people[0] if people else ""
            elif key == "collected":
                out[k] = state.get("collected", [])
            elif key == "entities":
                out[k] = state.get("entities", [])
            else:
                out[k] = state.get(key, "")
        else:
            out[k] = v
    return out


def _collect(state: Dict[str, Any], result: ToolResult, source: str) -> None:
    """Turn raw source rows into person-records the resolver can eat. This is
    the adapter between 'what a source returned' and 'what resolution needs'."""
    rows = result.data if isinstance(result.data, list) else []
    bucket = state.setdefault("collected", [])
    for row in rows:
        if source == "CDR":
            for side in ("caller", "receiver"):
                if row.get(side):
                    bucket.append({
                        "record_id": f"CDR{len(bucket):04d}", "source": "CDR",
                        "name": row[side], "phone": row.get(f"{side}_phone", ""),
                    })
        elif source == "FIN":
            for side in ("sender", "receiver"):
                if row.get(side):
                    bucket.append({
                        "record_id": f"FIN{len(bucket):04d}", "source": "FIN",
                        "name": row[side], "account": row.get(f"{side}_acc", ""),
                    })
        elif source == "VEH":
            bucket.append({
                "record_id": f"VEH{len(bucket):04d}", "source": "VEH",
                "name": row.get("owner", ""), "vehicle": row.get("number", ""),
                "address": row.get("address", ""),
            })


def _brief(args: Dict[str, Any]) -> str:
    """Arguments, short enough to read on a projector."""
    out = []
    for k, v in args.items():
        if isinstance(v, list):
            out.append(f"{k}=[{len(v)} items]")
        elif isinstance(v, dict):
            out.append(f"{k}={{...}}")
        else:
            s = str(v)
            out.append(f"{k}={s[:40] + '...' if len(s) > 40 else s!r}"
                       if len(s) > 40 else f"{k}={s!r}")
    return ", ".join(out)


def _check(step: Step, result: ToolResult) -> bool:
    """Did that step achieve what it was for? Kept separate from execution so
    'it ran' and 'it worked' are never conflated."""
    if not result.ok:
        return False
    if result.data in (None, [], {}):
        return False
    return True


# ---------------------------------------------------------------- recovery

def _tried(run: Run, tool: str) -> List[str]:
    """Names this run has already searched with, per tool. Without this the
    agent re-tries a spelling it has already watched fail.

    A list rather than a set because run.state is serialised into the API
    response, and a set is not JSON.
    """
    book = run.state.setdefault("_tried_names", {})
    return book.setdefault(tool, [])


def _recover(run: Run, step: Step, result: ToolResult) -> List[Step]:
    """Produce replacement steps for a failure. Returns [] if nothing sensible
    can be tried, which is an honest outcome and gets recorded as such.

    Two guards keep this from running away, and both are deliberate:

      depth   a retry is never itself retried. Recovery is one hop deep, so a
              failed alternate spelling ends that branch instead of asking for
              the alternates of the alternate.
      tried   a spelling already searched in this run is never searched again,
              even by a different failing step.
    """
    code = result.reason_code

    # The baseline the eval harness compares against: the same planner and the
    # same tools, but a search that finds nothing is simply the end. Read from
    # the environment on every call so the harness can run both modes in one
    # process.
    if os.getenv("CASEFLOW_BASELINE") == "1":
        trace.record(run.id, "recovery",
                     "baseline mode - no identity-aware retry available",
                     step_id=step.id)
        return []

    # ---- the identity-aware retry -------------------------------------
    if code == "no_results" and step.tool in ("search_cdr", "search_financial",
                                              "search_vehicle"):
        if step.depth >= 1:
            trace.record(run.id, "recovery",
                         f"the alternate spelling {step.args.get('name') or step.args.get('owner')!r} "
                         f"also returned nothing — not retrying a retry",
                         step_id=step.id)
            return []

        name = (step.args.get("name") or step.args.get("owner") or "")
        if not name:
            return []

        trace.record(run.id, "recovery",
                     f"no records for {name!r} — asking the resolver what else "
                     f"this person is called", step_id=step.id)
        trace.record(run.id, "tool_call", "get_name_variants",
                     step_id=step.id, args={"name": name})
        variants_result = tools.call("get_name_variants", name=name)

        if not variants_result.ok:
            trace.record(run.id, "failure",
                         f"no known variants of {name!r} — cannot recover",
                         step_id=step.id)
            return []

        seen = _tried(run, step.tool)
        if name.strip().lower() not in seen:
            seen.append(name.strip().lower())

        variants = [v for v in (variants_result.data or [])
                    if v.strip().lower() not in seen]
        if not variants:
            trace.record(run.id, "recovery",
                         f"every known spelling of {name!r} has already been "
                         f"searched — nothing left to try", step_id=step.id)
            return []

        variants = variants[:MAX_RECOVERY_ATTEMPTS]
        seen.extend(v.strip().lower() for v in variants)

        trace.record(run.id, "recovery",
                     f"found {len(variants)} other spellings: "
                     f"{', '.join(variants)} — retrying",
                     step_id=step.id, variants=variants)

        arg_key = "owner" if step.tool == "search_vehicle" else "name"
        return [
            Step(tool=step.tool, args={**step.args, arg_key: v},
                 intent=f"retry with the spelling {v!r}",
                 recovers=step.id, depth=step.depth + 1)
            for v in variants
        ]

    # ---- a source that isn't available: carry on without it ------------
    if code in ("graph_unavailable", "source_unavailable", "not_configured"):
        trace.record(run.id, "recovery",
                     f"{step.tool} unavailable — continuing without it",
                     step_id=step.id)
        return []

    return []


# ---------------------------------------------------------------- the gate

def _needs_approval(step: Step, run: Run) -> Optional[ApprovalRequest]:
    spec = tools.spec_of(step.tool)
    if spec is None or spec.risk is Risk.AUTO:
        return None

    preview = {"tool": step.tool, "args": step.args}
    reasons: List[str] = []
    if spec.risk is Risk.ALWAYS_ASK:
        reasons.append("This cannot be undone and a person receives it.")
    else:
        reasons.append("This writes into the case record, which the next "
                       "officer will act on.")

    return approval.request(
        run_id=run.id, step_id=step.id, tool=step.tool,
        summary=step.intent or f"run {step.tool}",
        reasons=reasons, preview=preview, risk=spec.risk,
    )


def _flagged_merges(run: Run) -> None:
    """Uncertain identity merges are the other path to the gate. Each one gets
    its own request carrying the resolver's own plain-English reasons."""
    for pair in (run.state.get("flagged") or [])[:20]:
        req = approval.request(
            run_id=run.id, step_id="resolution",
            tool="resolve_entities",
            summary=f"Same person? {pair.get('entities_to_merge')}",
            reasons=pair.get("reasons", []),
            preview=pair.get("preview", {}),
            risk=Risk.ASK,
            confidence=pair.get("confidence"),
        )
        # Traced like any other approval, so the count in the trace is the
        # count an officer would actually see in the queue.
        trace.record(run.id, "approval_requested", req.summary,
                     step_id="resolution", approval_id=req.id,
                     risk=req.risk.value, confidence=req.confidence)


# ---------------------------------------------------------------- execution

def _execute(run: Run, step: Step) -> ToolResult:
    args = _fill(step.args, run.state)
    step.args = args
    step.attempts += 1
    step.status = StepStatus.RUNNING
    trace.record(run.id, "step_start", step.intent or step.tool,
                 step_id=step.id, tool=step.tool)
    # The readable line stays readable — a list of forty resolved entities is
    # summarised rather than dumped. The full arguments are still in the
    # event's data, so nothing is lost from the record itself.
    trace.record(run.id, "tool_call", f"{step.tool}({_brief(args)})",
                 step_id=step.id, args=args)

    result = tools.call(step.tool, **args)

    trace.record(run.id, "tool_result",
                 "ok" if result.ok else f"failed: {result.error}",
                 step_id=step.id, ok=result.ok, reason=result.reason_code)

    # fold what we learned into run state
    if result.facts:
        for k, v in result.facts.items():
            run.state[k] = v
    if step.tool == "search_cdr" and result.ok:
        _collect(run.state, result, "CDR")
    elif step.tool == "search_financial" and result.ok:
        _collect(run.state, result, "FIN")
    elif step.tool == "search_vehicle" and result.ok:
        _collect(run.state, result, "VEH")
    elif step.tool == "resolve_entities" and result.ok:
        _flagged_merges(run)

    step.result = result.to_dict()
    return result


MAX_STEPS = int(os.getenv("CASEFLOW_MAX_STEPS", "30"))


def _finish(run: Run) -> Run:
    from .contracts import now
    run.status = RunStatus.COMPLETED
    run.finished_at = now()
    run.summary = _summarise(run)
    trace.record(run.id, "finish", run.summary)
    return run


def _drive(run: Run, queue: List[Step], auto_approve: bool,
           already_approved: Optional[str] = None) -> Run:
    """The loop itself, shared by a fresh run and a resumed one.

    Keeping it in one function is the reason a resumed run behaves exactly
    like an uninterrupted one: it still checks, still recovers, and still
    stops at the *next* gated step instead of quietly skipping it.

    `already_approved` is the id of the one step whose approval has just been
    granted — it passes the gate once and only once.
    """
    executed = len(run.state.get("_executed", []))

    while queue and executed < MAX_STEPS:
        step = queue.pop(0)
        executed += 1
        run.state.setdefault("_executed", []).append(step.tool)

        # --- gate -------------------------------------------------------
        if step.id != already_approved:
            req = _needs_approval(step, run)
            if req is not None:
                trace.record(run.id, "approval_requested", req.summary,
                             step_id=step.id, approval_id=req.id,
                             risk=req.risk.value)
                decision = approval.auto_decide(req) if auto_approve else None
                if decision is None:
                    step.status = StepStatus.AWAITING_APPROVAL
                    run.pending_approval = req
                    run.status = RunStatus.AWAITING_APPROVAL
                    # The paused step is saved with the rest of the queue, so
                    # approving it runs it — an earlier version dropped it and
                    # the approved action silently never happened.
                    run.state["_resume_queue"] = [s.to_dict()
                                                  for s in [step] + queue]
                    trace.record(run.id, "finish",
                                 "paused - waiting for an officer to decide")
                    return run
                approval.decide(req.id, True, by="eval-harness")
                trace.record(run.id, "approval_granted",
                             f"{step.tool} approved automatically (eval mode)",
                             step_id=step.id)
        already_approved = None

        # --- execute + check -------------------------------------------
        result = _execute(run, step)

        if _check(step, result):
            step.status = StepStatus.DONE
            # A retry that worked closes the failure it came from - and the
            # other spellings queued alongside it are now pointless, so they
            # are dropped rather than run. Without this the agent keeps
            # searching after it has already found the person.
            if step.recovers:
                tried = step.args.get("name") or step.args.get("owner") or ""
                trace.record(run.id, "recovered",
                             f"found under the spelling {tried!r} - the "
                             f"earlier search had missed it",
                             step_id=step.id, recovers=step.recovers)
                dropped = [s for s in queue if s.recovers == step.recovers]
                if dropped:
                    for s in dropped:
                        s.status = StepStatus.SKIPPED
                    queue = [s for s in queue if s.recovers != step.recovers]
                    trace.record(run.id, "recovery",
                                 f"{len(dropped)} further spellings not "
                                 f"searched - already found",
                                 step_id=step.id)
            continue

        step.status = StepStatus.FAILED
        trace.record(run.id, "failure",
                     result.error or f"{step.tool} produced nothing",
                     step_id=step.id, reason=result.reason_code)

        replacements = _recover(run, step, result)
        if replacements:
            step.status = StepStatus.RECOVERED
            queue = replacements + queue
        else:
            trace.record(run.id, "recovery",
                         f"no recovery for {step.tool} - continuing",
                         step_id=step.id)

    if queue:
        trace.record(run.id, "failure",
                     f"step budget of {MAX_STEPS} reached with "
                     f"{len(queue)} steps unfinished")
    return _finish(run)


def run_goal(goal: str, case_id: Optional[str] = None,
             auto_approve: bool = False) -> Run:
    """Plan and execute. Returns when the run finishes or stops for a human."""
    run = Run(goal=goal, case_id=case_id)
    with _LOCK:
        _RUNS[run.id] = run

    trace.record(run.id, "goal", goal)

    run.plan = llm.plan(goal, tools.specs())
    trace.record(run.id, "plan",
                 f"{len(run.plan.steps)} steps ({run.plan.source})",
                 steps=[s.tool for s in run.plan.steps])

    return _drive(run, list(run.plan.steps), auto_approve)


def resume(run_id: str, approval_id: str, approved: bool,
           by: str = "officer") -> Optional[Run]:
    """Continue a run after an officer rules on the pending approval.

    Approving does not merely unblock the run - it runs the very step that was
    waiting. Declining stops the run there, which is the point of asking.
    """
    run = get_run(run_id)
    if run is None:
        return None
    req = approval.decide(approval_id, approved, by=by)
    if req is None:
        return run

    trace.record(run.id,
                 "approval_granted" if approved else "approval_denied",
                 f"{req.tool} {'approved' if approved else 'rejected'} by {by}",
                 step_id=req.step_id, approval_id=approval_id)

    run.pending_approval = None

    # An identity decision is not a step in the queue - ruling on it does not
    # restart anything, it just records what the officer decided.
    if req.step_id == "resolution":
        if approved:
            run.state.setdefault("merges_confirmed", []).append(req.preview)
        else:
            run.state.setdefault("merges_rejected", []).append(req.preview)
        return run

    if not approved:
        from .contracts import now
        run.status = RunStatus.COMPLETED
        run.finished_at = now()
        run.summary = f"Stopped: the officer declined {req.tool}."
        trace.record(run.id, "finish", run.summary)
        return run

    raw_queue = run.state.pop("_resume_queue", [])
    queue = [Step(tool=r["tool"], args=r.get("args", {}),
                  intent=r.get("intent", ""), id=r.get("id") or _new_id(),
                  recovers=r.get("recovers"), depth=r.get("depth", 0))
             for r in raw_queue]
    run.status = RunStatus.RUNNING
    return _drive(run, queue, auto_approve=False,
                  already_approved=req.step_id)


def _summarise(run: Run) -> str:
    st = trace.summarise(run.id)
    ents = run.state.get("entities") or []
    conn = run.state.get("connector")
    bits = [f"{st['tool_calls']} tool calls"]
    if run.state.get("collected"):
        bits.append(f"{len(run.state['collected'])} records read")
    if ents:
        bits.append(f"{len(ents)} people resolved")
    if st["failures"]:
        bits.append(f"{st['failures']} failures, {st['recoveries']} recovered")
    waiting = len(approval.pending(run.id))
    if waiting:
        bits.append(f"{waiting} identity decisions waiting for an officer")
    elif st["approvals_requested"]:
        bits.append(f"{st['approvals_requested']} sent for approval")
    line = " · ".join(bits)
    if conn:
        line = f"Connector found: {conn}. " + line
    return line
