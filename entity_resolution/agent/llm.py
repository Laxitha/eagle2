"""
llm.py — the planning brain, with a deterministic fallback.

Two reasons the fallback exists and is not a shortcut:

  * the demo must not depend on a network call succeeding on conference wifi
  * the eval harness needs runs to be reproducible, and an LLM is not

Set EAGLE_LLM=anthropic|openai|none. With a key present the LLM plans; without
one, `_fallback_plan` produces a sensible plan for investigation goals. Which
one ran is recorded on the Plan as `source`, so the trace never pretends.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, List, Optional

from .contracts import Plan, Step

PROVIDER = os.getenv("EAGLE_LLM", "none").lower()
MODEL = os.getenv("EAGLE_LLM_MODEL", "")

SYSTEM = """You plan investigative work for CaseFlow, an agent used by police \
investigators.

You are given a goal and a list of tools. Return ONLY a JSON array of steps:
[{"tool": "<name>", "args": {...}, "intent": "<why, one short sentence>"}]

Rules:
- Read sources before resolving. Resolve before building the graph.
- Never call an ACT tool (update_case_record, draft_report, send_email) unless
  the goal explicitly asks for it.
- Keep plans under 10 steps.
- If a search may fail because a name is written differently in another
  system, that is fine: the executor recovers using get_name_variants.
"""


def _anthropic(prompt: str) -> Optional[str]:
    try:
        import anthropic
    except ImportError:
        return None
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key:
        return None
    try:
        client = anthropic.Anthropic(api_key=key)
        msg = client.messages.create(
            model=MODEL or "claude-sonnet-4-5",
            max_tokens=1500,
            system=SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        return "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
    except Exception:
        return None


def _openai(prompt: str) -> Optional[str]:
    try:
        from openai import OpenAI
    except ImportError:
        return None
    if not os.getenv("OPENAI_API_KEY"):
        return None
    try:
        client = OpenAI()
        r = client.chat.completions.create(
            model=MODEL or "gpt-4o",
            messages=[{"role": "system", "content": SYSTEM},
                      {"role": "user", "content": prompt}],
            max_tokens=1500,
        )
        return r.choices[0].message.content
    except Exception:
        return None


def _extract_json(text: str) -> Optional[List[Dict]]:
    if not text:
        return None
    m = re.search(r"\[.*\]", text, re.S)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
        return data if isinstance(data, list) else None
    except Exception:
        return None


def _case_id_in(goal: str) -> str:
    m = re.search(r"(CASE[-\s]?\d+|FIR[/\-\s]?\S+)", goal, re.I)
    return m.group(1).replace(" ", "-").upper() if m else "CASE-104"


def _fallback_plan(goal: str) -> List[Dict]:
    """A fixed investigative plan. Deliberately mirrors what an officer does:
    open the case, pull each source for the named person, resolve identities,
    build the picture, find who connects."""
    case = _case_id_in(goal)
    steps = [
        {"tool": "read_case", "args": {"case_id": case},
         "intent": "open the case file and see who is named in it"},
        {"tool": "search_cdr", "args": {"name": "{person}"},
         "intent": "pull call records for the named person"},
        {"tool": "search_financial", "args": {"name": "{person}"},
         "intent": "pull bank transfers for the named person"},
        {"tool": "search_vehicle", "args": {"owner": "{person}"},
         "intent": "check vehicle records"},
        {"tool": "resolve_entities", "args": {"records": "{collected}"},
         "intent": "work out which records describe the same person"},
        {"tool": "build_graph",
         "args": {"entities": "{entities}", "case_id": case},
         "intent": "write the resolved people into the case graph"},
        {"tool": "find_connector", "args": {"entities": "{entities}"},
         "intent": "find who links the most cases"},
    ]

    # An ACT step is added only when the goal asks for one. Reading and
    # thinking are free; writing into the case record is not, so the agent
    # does not decide on its own that a report is wanted.
    if re.search(r"\b(report|write.?up|brief|note for the file)\b", goal, re.I):
        steps.append({"tool": "draft_report",
                      "args": {"case_id": case, "entities": "{entities}",
                               "connector": "{connector}"},
                      "intent": "draft the findings into the case record"})
    # Sending findings out of the system is the ALWAYS_ASK path. It has to be
    # planned when the goal asks for it, or the gate that stops it can never
    # fire — the case an unattended run must still refuse to complete.
    if re.search(r"\b(e-?mail|forward|send (?:the |this )?findings|notify)\b",
                 goal, re.I):
        steps.append({"tool": "send_email",
                      "args": {"to": "SP", "subject": f"{case} — findings",
                               "body": "{connector}"},
                      "intent": "email the findings to the officer named"})
    return steps


def plan(goal: str, tool_specs: List[Dict]) -> Plan:
    raw: Optional[str] = None
    prompt = (f"GOAL: {goal}\n\nTOOLS:\n"
              + json.dumps(tool_specs, indent=2)
              + "\n\nReturn the JSON array of steps.")

    if PROVIDER == "anthropic":
        raw = _anthropic(prompt)
    elif PROVIDER == "openai":
        raw = _openai(prompt)

    steps_raw = _extract_json(raw or "")
    source = "llm"
    if not steps_raw:
        steps_raw, source = _fallback_plan(goal), "fallback"

    valid = {s["name"] for s in tool_specs}
    steps = [
        Step(tool=s.get("tool", ""), args=s.get("args", {}) or {},
             intent=s.get("intent", ""))
        for s in steps_raw
        if s.get("tool") in valid
    ]
    if not steps:
        steps = [Step(tool=s["tool"], args=s["args"], intent=s["intent"])
                 for s in _fallback_plan(goal)]
        source = "fallback"
    return Plan(goal=goal, steps=steps[:10], source=source)
