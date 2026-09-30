# CaseFlow Agent — the agent layer for EAGLE

An autonomous agent that works a case the way a district cyber-cell officer
does: opens the FIR, pulls each source for the people named in it, works out
which records describe the same person, builds the picture, and stops to ask
an officer before anything it cannot take back.

It is a layer, not a rewrite. The entity resolution, the normalizer and the
graph are the existing EAGLE code. This adds the loop on top.

---

## 1. Why this is an agent and not a script

Four things the problem statement asks for, and where each one lives:

| Requirement | Where it is |
|---|---|
| plans the steps | `llm.py` — an LLM plans when a key is present, a fixed investigative plan when it is not |
| checks its progress | `agent.py` → `_check()`, run after every single step |
| recovers when something fails | `agent.py` → `_recover()`, the identity-aware retry |
| asks before risky actions | `approval.py` + the gate in `agent.py` → `_drive()` |

The recovery is the part worth watching in the demo. A search that returns
nothing is not the end of the run: the agent asks the resolver what else that
person is called and searches again with each spelling. **That only works
because entity resolution sits underneath it.** An agent without this NLP
layer has nothing to ask.

---

## 2. Install and run, standalone

No database, no API key, no network. It runs on built-in fixture data.

```bash
cd eagle_agent
python -m entity_resolution.agent.demo          # if you added a demo module
```

Or straight from Python:

```python
from entity_resolution.agent import agent, trace

run = agent.run_goal(
    "Map the network around Suresh Nair in CASE-104 and find the connector",
    case_id="CASE-104")

print(trace.as_text(run.id))
print(run.summary)
```

Run the eval set:

```bash
python -m entity_resolution.agent.eval.run_eval
python -m entity_resolution.agent.eval.run_eval --json results.json
```

---

## 3. Wiring it into the existing EAGLE repo — two edits

**Edit 1 — put the folder in place.** Copy `entity_resolution/agent/` so it
sits beside the packages it uses:

```
entity_resolution/
├── nlp/            (existing — normalizer.py, entity_resolver.py)
├── graph/          (existing — db/, repository/)
└── agent/          (new)
```

**Edit 2 — mount the router** in whatever file creates the FastAPI app on
port 8001, next to the graph routes:

```python
from entity_resolution.agent.agent_api import router as agent_router
app.include_router(agent_router)
```

That is the whole integration. Nothing in `nlp/` or `graph/` is modified.

### What the adapter looks for

`tools.py` imports the existing modules and **falls back to fixtures if they
are not there** — so a Neo4j that did not start cannot kill a demo. It looks
for these, by any of these names:

| Needs | Accepted function names |
|---|---|
| resolve a list of records | `deduplicate`, `resolve_all`, `cluster_records` |
| score two names | `name_similarity`, `compare_names`, `name_score` |
| normalize a name | `normalize_name` |
| graph writes | `create_entity`, `create_lead` on the repository |

Check what actually loaded:

```python
from entity_resolution.agent import tools
print(tools.backends())     # {'graph': False, 'resolver': True, ...}
```

If `resolver` is `False`, the eval numbers below are measuring the stub, not
your resolver.

---

## 4. The HTTP surface

Mounted under `/agent` on the same port as the graph API.

| Method | Path | What it is for |
|---|---|---|
| POST | `/agent/run` | start a run; returns when it finishes or needs an officer |
| GET | `/agent/runs` | every run |
| GET | `/agent/runs/{id}` | one run with its plan and state |
| GET | `/agent/runs/{id}/trace` | the trace; `?fmt=text` for the readable one |
| GET | `/agent/approvals` | the officer's queue, least confident last |
| POST | `/agent/approvals/{id}` | `{"approved": true, "by": "SI Ramesh"}` |
| GET | `/agent/tools` | every tool with its risk tier — the policy, readable |

---

## 5. The human approval line

Three tiers, in `approval.py`, applied by tool and by confidence.

| Tier | What is in it | Why |
|---|---|---|
| **AUTO** | reading a source, an identity match at ≥ 0.90, building the graph, retrying a failed search | Nothing outside the agent's own working memory changes. It can be re-run. |
| **ASK** | writing into the case record; an identity match scoring 0.70–0.89 | A wrong merge here puts an innocent person inside a case file, and what is written into the record is what the next officer acts on. |
| **ALWAYS_ASK** | sending anything outside | It cannot be taken back and a person receives it. |

Two properties worth stating plainly:

- **Declining stops the run.** It does not skip the step and carry on — the
  run ends, and the trace says why.
- **The unattended eval harness cannot approve an ALWAYS_ASK action.**
  `EAGLE_AUTO_APPROVE=1` is refused for that tier. An automated run can
  never send an email.

Every uncertain merge reaches the officer with the resolver's own reasons in
plain English, not a score:

```
[0.85] Same person? ['ENT00003', 'ENT00004']
  - 'S Nair' and 'Suresh Nair' agree on the surname and the first initial.
  - No phone number, account or address appears in both records, so there
    is nothing to confirm it with.
  - Only above 0.90 does the system merge on its own. This scores 0.85,
    so it waits for you.
```

---

## 6. The trace

Append-only JSONL under `traces/` (set `EAGLE_TRACE_DIR` to move it). Nothing
is ever edited or removed, so **a failure that was later recovered from still
appears**. Written to disk as it happens, so a crashed run still leaves its
evidence.

A real run, failures included:

```
     goal        Map the network around Suresh Nair in CASE-104, find the connector and draft a report
     plan        8 steps (fallback)
     tool_call   read_case({'case_id': 'CASE-104'})
     tool_call   search_cdr({'name': 'Thiru Suresh Nair'})          ok
     tool_call   search_financial({'name': 'Thiru Suresh Nair'})    ok
     tool_call   search_vehicle({'owner': 'Thiru Suresh Nair'})     failed: no vehicle record
FAIL failure     no vehicle record
RCVR recovery    no records for 'Thiru Suresh Nair' — asking the resolver what else this person is called
     tool_call   get_name_variants
RCVR recovery    found 3 other spellings: S. Nair, SURESH NAIR, Suresh Nair — retrying
     tool_call   search_vehicle({'owner': 'S. Nair'})               ok
SAVE recovered   found under the spelling 'S. Nair' — the earlier search had missed it
RCVR recovery    2 further spellings not searched — already found
     tool_call   resolve_entities(...)                              ok
ASK  approval    Same person? ['ENT00003', 'ENT00004']
     tool_call   build_graph(...)                                   ok
     tool_call   find_connector(...)                                ok
ASK  approval    draft the findings into the case record
END  finish      paused — waiting for an officer to decide
OK   approval    draft_report approved by SI Ramesh
     tool_call   draft_report(...)                                  ok
END  finish      Connector found: Suresh Nair. 10 tool calls · 5 records read ·
                 4 people resolved · 1 failures, 1 recovered ·
                 1 identity decisions waiting for an officer
```

Read `recovery` and `recovered` as different things on purpose. A `recovery`
event is something the agent **tried**; `recovered` is only written when a
replacement step actually produced what the failed one could not. The eval
reports the second number, so the rate cannot be inflated by trying harder
and still failing.

---

## 7. Baseline vs result

Both columns are the same planner, the same tools and the same data. The
baseline is the agent with the NLP layer switched off (`EAGLE_BASELINE=1`):
names compared as exact strings, no honorific stripping, and a search that
returns nothing is simply the end. That is what a plain tool-calling agent
over the same sources actually does.

```
       BASELINE          WITH RESOLUTION
pass   4/12  (33%)       11/12  (92%)
steps  7.0               9.8
recov  0.0               0.8
sec    0.002             0.003
```

The agent takes about 40% more steps. That is the cost of the retries, and
it is what the extra 59 points of accuracy is bought with.

### The one it fails

**EV12 fails, and it is left failing.** Two different men are called Arun
Prasad — same name, different phones, nothing in common. Merging them would
put an innocent man inside a fraud case, which is the failure this project
cares about most. The fixture resolver bundled with this package groups by
name and merges them.

It is in the set to mark the line between the stub and the real resolver in
`entity_resolution/nlp`, whose ambiguity pass exists for exactly this.
**Re-run the eval after wiring that in and record what EV12 actually does.**
Do not report it as passing without having seen it pass.

Five of the twelve cases are ones the agent is meant to fail or refuse —
a non-existent case, a person in no source at all, a write that must stop
for approval, an email that must stop even unattended. An eval set made only
of winnable cases measures nothing.

---

## 8. One paragraph of context

District cyber-cell officers work cases across CDR dumps, bank statements,
vehicle records and FIRs in which the same man is written four different
ways — "Thiru Suresh Nair" in the complaint, "S. Nair" at the RTO, "SURESH
NAIR" at the bank. The linking is done by hand, and the link that is missed
is usually the one where the spelling differed. CaseFlow Agent plans the
searches, runs them across every source, and when one comes back empty it
asks the resolver what else that person is called and tries again — turning a
missed record into a found one. It writes nothing into the case record and
sends nothing outside without an officer approving it, and every step it
took, including the ones that failed, is in a trace the officer can read.

---

## 9. Environment variables

| Variable | Default | What it does |
|---|---|---|
| `EAGLE_LLM` | `none` | `anthropic`, `openai`, or `none` for the fixed plan |
| `EAGLE_LLM_MODEL` | provider default | model id |
| `EAGLE_TRACE_DIR` | `traces` | where traces are written |
| `EAGLE_REPORT_DIR` | `reports` | where drafted dossiers land |
| `EAGLE_MAX_RECOVERY` | `3` | alternate spellings tried per failed search |
| `EAGLE_MAX_STEPS` | `30` | hard step budget for one run |
| `EAGLE_AUTO_APPROVE` | `0` | eval harness only; never honoured for ALWAYS_ASK |
| `EAGLE_BASELINE` | `0` | switches the NLP layer off, for the comparison |
| `EAGLE_EMAIL_REAL` | `0` | email is simulated unless this is `1` |

---

## 10. Files

```
entity_resolution/agent/
├── contracts.py    the shapes everything agrees on; imports nothing
├── tools.py        the tool registry + the adapter to existing EAGLE
├── llm.py          planner, with a deterministic fallback
├── approval.py     the three tiers and the queue
├── trace.py        append-only record, JSONL + readable
├── agent.py        the loop: plan → execute → check → recover
├── agent_api.py    the FastAPI router
└── eval/
    ├── cases.json  12 cases, answers written down beforehand
    └── run_eval.py baseline vs result
```

`contracts.py` imports no Neo4j, no FastAPI and no LLM on purpose — one
dependency-free vocabulary file is what lets the planner, the tools, the gate
and the trace be worked on by different people without colliding.
