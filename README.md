# EAGLE

**Evidence → Reason → Action.** EAGLE turns fragmented investigation data — call
records, financial transactions, vehicle registrations, FIR reports — into a
unified knowledge graph that surfaces hidden connections between cases and
ranks entities investigators should look at first.

## Why

Investigations generate data across systems that don't talk to each other:
call detail records, bank transaction logs, vehicle registries, and
free-text FIR reports. The same person shows up as "Ravi Kumar" in one file
and "R. Kumar" in another. Connections between open cases go unnoticed
because no one system sees across all of them. EAGLE ingests all of it,
resolves entities across sources, builds a graph, and scores who matters.

## Architecture

```
data/            synthetic investigation dataset + ground truth (see data/ground_truth.md)
nlp/             entity extraction (NER, relations) + normalization + resolution
backend/         FastAPI + PostgreSQL (structured records) + Neo4j (graph)
frontend/        Next.js + Cytoscape.js investigation dashboard
docs/            API reference, user guide, pitch materials
```

Data flow: raw records (`data/*.csv`, `investigation_reports/*.txt`) →
`nlp/ner_pipeline.py` + `nlp/relation_extractor.py` extract entities and
relationships → `nlp/normalizer.py` + `nlp/entity_resolver.py` +
`nlp/unified_entity.py` collapse duplicate mentions into unified entities →
`backend/app/services/graph_builder.py` writes nodes/relationships into
Neo4j → `backend/app/services/priority_scoring.py` +
`graph_analytics.py` rank entities → the frontend renders the graph, leads,
and reports.

## Tech stack

- **Backend**: FastAPI, PostgreSQL (SQLAlchemy), Neo4j, networkx, JWT auth
- **NLP**: spaCy (NER + dependency parsing), RapidFuzz + phonetics (entity
  resolution), sentence-transformers (semantic similarity)
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS,
  Cytoscape.js, Recharts

## Setup

### Full stack via Docker

```bash
docker compose up --build
```

Backend on `http://localhost:8000`, Neo4j browser on `http://localhost:7474`,
Postgres on `5432`.

### Local development

```bash
# Backend
cd backend
pip install -r requirements.txt
python -m spacy download en_core_web_lg
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

### Generate the synthetic dataset

```bash
cd data
python3 generate_dataset.py
```

Regenerates `cases.csv`, `cdr_records.csv`, `financial_records.csv`,
`vehicle_records.csv`, `location_records.csv`,
`investigation_reports/*.txt`, and `ground_truth.md`.

### Populate the graph from the dataset (demo data)

```bash
cd backend
python -m app.services.pipeline
```

## Features

- CSV/JSON ingestion (`POST /api/ingest/csv`, `/json`)
- Entity normalization + fuzzy/phonetic resolution across sources
- Neo4j knowledge graph: Person, Phone, Vehicle, Case, Account, Location
  nodes; CALLED, OWNED, VISITED, TRANSFERRED relationships with confidence
  + source metadata
- Graph analytics: centrality, community detection, shortest path, PageRank
- Priority scoring (network 25% + cross-case 20% + evidence 20% +
  temporal 15% + diversity 10% + anomaly 10%)
- Evidence-linked leads with human verification workflow
- Interactive graph visualization, entity timelines, intelligence reports

See [docs/API.md](docs/API.md) for the full endpoint reference and
[docs/USER_GUIDE.md](docs/USER_GUIDE.md) for a walkthrough.

## Ethics & scope

EAGLE is a decision-support tool for investigators, not an automated
accusation engine. Every relationship the graph surfaces is traceable to a
source record and a confidence score; every priority-ranked lead requires
human verification before action. It does not perform predictive policing
or make determinations of guilt.
