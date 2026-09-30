"""
run_eval.py — the eval harness.

Two of the submission's five requirements are answered here:

  "your own eval set"      cases.json, with the answers written down before
                           the agent ran, and five cases it is meant to fail
                           or refuse
  "baseline vs result"     every case runs twice — once with recovery and
                           resolution switched off (the baseline: what a
                           plain tool-calling agent does), once with them on

The baseline is not a straw man. It is the same planner, the same tools and
the same data. The only difference is that when a search returns nothing, the
baseline reports nothing found, and identities are matched on the exact
string. That is what an agent without entity resolution underneath actually
does, and the gap between the two columns is the whole argument for this
project.

Run:
    python -m entity_resolution.agent.eval.run_eval
    python -m entity_resolution.agent.eval.run_eval --json results.json
"""

from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path
from typing import Any, Dict, List

os.environ.setdefault("EAGLE_AUTO_APPROVE", "1")   # unattended; never ALWAYS_ASK
# The eval measures the resolver, not the database. Keep the graph out of the
# loop so the numbers are deterministic and can't be moved by Neo4j being up,
# down, or slow. build_graph still runs on its in-memory path.
os.environ.setdefault("EAGLE_DISABLE_GRAPH", "1")

from .. import agent, approval, trace                       # noqa: E402

HERE = Path(__file__).parent
CASES = json.loads((HERE / "cases.json").read_text(encoding="utf-8"))


# ---------------------------------------------------------------- helpers

def _names(run) -> List[str]:
    out = []
    for e in (run.state.get("entities") or []):
        n = (e.get("canonical") or {}).get("name", "")
        if n:
            out.append(n)
        out.extend((e.get("variants") or {}).get("name", []))
    return out


def _contains(names: List[str], wanted: str) -> bool:
    """Loose on spelling, strict on identity: 'Suresh Nair' matches
    'SURESH NAIR' but never matches 'Ravi Kumar'."""
    w = "".join(ch for ch in wanted.lower() if ch.isalnum() or ch == " ").split()
    for n in names:
        toks = "".join(ch for ch in n.lower() if ch.isalnum() or ch == " ").split()
        if all(any(t == p or (len(p) == 1 and t.startswith(p)) for t in toks)
               for p in w):
            return True
    return False


def _score(case: Dict, run) -> Dict[str, Any]:
    """One case, scored against what was written down beforehand."""
    names = _names(run)
    st = trace.summarise(run.id)
    checks: List[Dict[str, Any]] = []

    def check(label: str, ok: bool):
        checks.append({"check": label, "pass": bool(ok)})

    for want in case.get("must_find", []):
        check(f"found {want!r}", _contains(names, want))
    for avoid in case.get("must_not_find", []):
        check(f"did not pull in {avoid!r}", not _contains(names, avoid))
    if case.get("expect_connector"):
        check(f"named {case['expect_connector']!r} as the connector",
              _contains([str(run.state.get("connector") or "")],
                        case["expect_connector"]))
    if case.get("expect_recovery"):
        check("recovered from a failed search", st["recoveries"] > 0)
    if case.get("expect_approval"):
        check("stopped and asked an officer",
              run.status.value == "awaiting_approval"
              or st["approvals_requested"] > 0)
    if case.get("expect_no_write"):
        check("wrote nothing to the case record",
              not run.state.get("report") and not run.state.get("email_to"))
    if case.get("expect_separate"):
        # The namesake test. Two people share a name; the run must end with
        # each identifier attached to its own entity, not both to one.
        wanted = set(case["expect_separate"])
        homes = set()
        for rec in (run.state.get("collected") or []):
            if rec.get("phone") in wanted:
                homes.add(rec.get("phone"))
        merged_into_one = any(
            e.get("record_count", 0) > 1
            and len(set((e.get("variants") or {}).get("name", []))) == 1
            and "prasad" in str((e.get("canonical") or {}).get("name", "")).lower()
            for e in (run.state.get("entities") or []))
        check(f"kept the two namesakes apart ({', '.join(sorted(wanted))})",
              len(homes) == len(wanted) and not merged_into_one)

    if case.get("expect_failure"):
        check("said it could not do it rather than inventing an answer",
              not names and st["failures"] > 0)

    passed = sum(1 for c in checks if c["pass"])
    return {
        "checks": checks,
        "passed": passed,
        "total": len(checks),
        "success": passed == len(checks) and len(checks) > 0,
        "steps": st["tool_calls"],
        "failures": st["failures"],
        "recoveries": st["recoveries"],
        "approvals": st["approvals_requested"],
        "seconds": round(run.elapsed(), 3),
    }


def _run_case(case: Dict, baseline: bool) -> Dict[str, Any]:
    os.environ["EAGLE_BASELINE"] = "1" if baseline else "0"
    t0 = time.time()
    run = agent.run_goal(case["goal"], case_id=case.get("case_id"),
                         auto_approve=True)
    res = _score(case, run)
    res.update({"id": case["id"], "goal": case["goal"], "run_id": run.id,
                "wall_clock": round(time.time() - t0, 3),
                "mode": "baseline" if baseline else "agent"})
    return res


# ---------------------------------------------------------------- report

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", help="also write the full results here")
    ap.add_argument("--only", help="run one case id, e.g. EV01")
    args = ap.parse_args()

    cases = CASES["cases"]
    if args.only:
        cases = [c for c in cases if c["id"] == args.only]

    rows = []
    for case in cases:
        base = _run_case(case, baseline=True)
        full = _run_case(case, baseline=False)
        rows.append({"case": case, "baseline": base, "agent": full})

    # ---- table ---------------------------------------------------------
    print()
    print(f"{'CASE':<6} {'BASELINE':<22} {'WITH RESOLUTION':<22} WHAT THE CASE TESTS")
    print("-" * 100)
    for r in rows:
        b, a = r["baseline"], r["agent"]
        bs = f"{b['passed']}/{b['total']} checks"
        as_ = f"{a['passed']}/{a['total']} checks"
        mark = "  " if b["success"] == a["success"] else ("^ " if a["success"] else "! ")
        note = (r["case"].get("note") or "").split(".")[0]
        print(f"{r['case']['id']:<6} {bs:<22} {mark}{as_:<20} {note[:52]}")

    nb = sum(1 for r in rows if r["baseline"]["success"])
    na = sum(1 for r in rows if r["agent"]["success"])
    n = len(rows)

    def avg(mode, key):
        return sum(r[mode][key] for r in rows) / max(n, 1)

    print("-" * 100)
    print(f"{'':6} {'BASELINE':<22} {'WITH RESOLUTION':<22}")
    print(f"{'pass':<6} {f'{nb}/{n}  ({nb/n:.0%})':<22} {f'{na}/{n}  ({na/n:.0%})':<22}")
    print(f"{'steps':<6} {avg('baseline','steps'):<22.1f} {avg('agent','steps'):<22.1f}")
    print(f"{'recov':<6} {avg('baseline','recoveries'):<22.1f} {avg('agent','recoveries'):<22.1f}")
    print(f"{'sec':<6} {avg('baseline','seconds'):<22.3f} {avg('agent','seconds'):<22.3f}")
    print()
    print("A failed check is printed in full below so the number above can be "
          "audited rather than trusted.")
    for r in rows:
        bad = [c["check"] for c in r["agent"]["checks"] if not c["pass"]]
        if bad:
            print(f"  {r['case']['id']}: " + "; ".join(bad))
    print()

    if args.json:
        Path(args.json).write_text(json.dumps(rows, indent=2, default=str),
                                   encoding="utf-8")
        print(f"full results -> {args.json}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
