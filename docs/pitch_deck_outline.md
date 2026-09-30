# CaseFlow Pitch Deck — Outline (Farisa's Day 3 deliverable)

Build this as the actual .pptx/slides; this file is the content skeleton.

1. **Title** — CaseFlow. Evidence → Reason → Action.
2. **Problem** — Investigators drown in disconnected data: CDRs, financial
   records, vehicle registries, FIR reports. The same person appears under
   three different name spellings across three files nobody cross-references.
3. **Context** — cite 3-5 stats on investigation/data-fragmentation
   challenges (research this — see competitive analysis below).
4. **Existing gaps** — ICJS, DataWalk, Palantir, IBM i2: what they do well,
   where they fall short for this use case (cost, closed-source, no
   India-specific entity resolution, no built-in evidence-to-action pipeline).
5. **Solution** — CaseFlow: ingest → normalize/resolve → knowledge graph →
   priority-ranked leads → human-verified action, with every link traceable
   to a source.
6. **Architecture** — the diagram from README.md's Architecture section.
7. **Evidence → Reason → Action** — walk the hidden-connector-chain example
   from `data/ground_truth.md` end to end: three cases, three officers,
   one interstate network CaseFlow surfaces that no single case file would.
8. **Differentiators** — cross-source entity resolution tuned for Indian
   names/phones, transparent evidence trail (not a black box), human
   verification gate on every lead, open architecture (not vendor lock-in).
9. **Demo** — live walkthrough (script below).
10. **Tech stack** — FastAPI, PostgreSQL, Neo4j, spaCy, Next.js, Cytoscape.js.
11. **Ethics** — decision-support not automated accusation; every lead
    requires human verification; confidence scores are shown, not hidden.
12. **Future** — additional data source connectors, active-learning loop on
    resolver thresholds from investigator verify/reject decisions, mobile app.
13. **Team** — 6 roles: backend architect, frontend, NLP extraction, entity
    resolution, research/data, UX/testing/docs.

## Demo script (5-7 min)

1. (30s) Problem statement — three unrelated-looking cases.
2. (1 min) Upload the synthetic dataset, show normalization catching
   "+91 98765 43210" == "9876543210" == "R. Kumar".
3. (2 min) Open the Graph page — click through Ravi Kumar → Suresh Reddy →
   Arun Nair, showing the hidden chain across FIR-101/104/109.
4. (1 min) Leads page — show the auto-generated, scored, "why" — verify one.
5. (1 min) Generate the Intelligence Report for the case.
6. (30s) Close on the ethics/human-in-the-loop point.

## Competitive analysis (research, Day 2)

| Tool | Strength | Gap CaseFlow fills |
|---|---|---|
| ICJS | Government-integrated | No cross-source entity resolution, no priority scoring |
| DataWalk | Strong graph analytics | Expensive, not India-context tuned |
| Palantir Gotham | Powerful, proven | Closed-source, high cost, steep onboarding |
| IBM i2 | Established in law enforcement | Manual link analysis, no automated NLP extraction |

Fill in real citations/stats before presenting — this table is a starting
skeleton for Farisa's research pass, not sourced content.

## One-pager

A single page combining slides 1, 2, 5, 9 (title, problem, solution, demo
screenshot) — build once screenshots from the working app are available.
