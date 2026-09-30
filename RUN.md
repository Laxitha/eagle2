# CaseFlow — run guide

Node modules and the Python venv are NOT included (keeps the zip small). Recreate them:

## 1. Backend — the agent + demo API (port 8010)
    cd <project>
    python3 -m venv .venv && source .venv/bin/activate
    pip install fastapi uvicorn pydantic rapidfuzz phonetics neo4j networkx pandas pdfminer.six
    AGENT_DEV_PORT=8010 python -m entity_resolution.agent.dev_server

## 2. Frontend — the dashboard (port 3000/3001)
    cd frontend
    npm install
    npm run dev
Open http://localhost:3000 (or :3001).
frontend/.env.local points the UI at the backend on :8010.

## What's here
- entity_resolution/agent/  — the CaseFlow agent layer
    - eagle_backend.py   bridge to the real nlp/ resolver
    - graph_backend.py   bridge to Neo4j (optional; degrades to in-memory)
    - webstore.py        in-memory case store: ingest -> resolve -> graph + leads (starts EMPTY)
    - webparsers.py      file parsers: csv/tsv/txt/json/gml/graphml/xml/pdf
    - webagent.py        chat agent that answers over UPLOADED data (no sample data)
    - dev_server.py      hosts /agent + /api for the frontend without Postgres
    - eval/              12-case eval (resolver-only): python -m entity_resolution.agent.eval.run_eval
- frontend/              — Next.js dashboard (upload, graph, agent chat, leads, reports)

## Notes
- Graph writes need a live Neo4j (bolt://localhost:7687). Without it the store still works in-memory.
- The eval runs with the graph disabled and is deterministic (12/12).
- History endpoints (/api/history) exist in webstore.py; the History UI page is not yet built.
