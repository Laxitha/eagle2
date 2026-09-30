"""
demo.py — the two-minute demo, runnable with one command.

    python -m entity_resolution.agent.demo

No database, no API key, no network. It runs the same code the API runs and
prints the trace, so what the judges see is the system working rather than a
recording of it.

The run is chosen so that all four agent behaviours appear in one trace:
a plan, a search that fails, a recovery that succeeds, and two things the
agent refuses to do without an officer.
"""

from __future__ import annotations

import sys

from . import agent, approval, tools, trace

GOAL = ("Map the network around Suresh Nair in CASE-104, find the connector "
        "and draft a report")

LINE = "=" * 78


def main() -> int:
    print(LINE)
    print("CaseFlow Agent")
    print(LINE)
    b = tools.backends()
    print(f"resolver: {'real' if b['resolver'] else 'fixture stub'}   "
          f"graph: {'Neo4j' if b['graph'] else 'in-memory fixture'}")
    print(f"\nGOAL: {GOAL}\n")
    print(LINE)

    run = agent.run_goal(GOAL, case_id="CASE-104")
    print(trace.as_text(run.id))

    print(LINE)
    print("STOPPED. Waiting for an officer:\n")
    for p in approval.pending(run.id):
        conf = f"{p['confidence']:.2f}" if p["confidence"] else p["risk"]
        print(f"  [{conf}] {p['summary']}")
        for r in p["reasons"]:
            print(f"        - {r}")
        print()

    gate = run.pending_approval
    if gate is None:
        print("(nothing was gated — check the plan)")
        return 1

    print(LINE)
    print(f"An officer approves: {gate.summary!r}\n")
    run = agent.resume(run.id, gate.id, approved=True, by="SI Ramesh")

    print("\n".join(trace.as_text(run.id).splitlines()[-4:]))
    print(LINE)
    print(run.summary)
    print(LINE)
    print("\nWhat just happened, in one line each:")
    print("  1. It planned the steps itself, then ran them.")
    print("  2. The vehicle search found nothing — the RTO holds him as")
    print("     'S. Nair', the FIR names him in full.")
    print("  3. It asked the resolver what else he is called and searched")
    print("     again. That record would have been missed by hand.")
    print("  4. It would not write to the case record until an officer said")
    print("     yes, and one identity it is not sure about is still waiting.")
    print("  5. Every step above, including the failure, is in traces/.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
