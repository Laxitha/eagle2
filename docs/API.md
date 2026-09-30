# EAGLE API Reference

Base URL: `http://localhost:8000`. All endpoints except `/health`,
`/api/auth/register`, `/api/auth/login` require `Authorization: Bearer <token>`.

## Auth

### `POST /api/auth/register`
Body: `{ username, email, password, role? }` (role defaults to `investigator`).
Returns: `{ access_token, token_type }`.

### `POST /api/auth/login`
Form-encoded (`OAuth2PasswordRequestForm`): `username`, `password`.
Returns: `{ access_token, token_type }`.

### `GET /api/auth/me`
Returns the current user's `{ id, username, email, role }`.

## Ingest

### `POST /api/ingest/csv`
Multipart `file`. Returns `{ filename, rows_ingested, columns }`.

### `POST /api/ingest/json`
Multipart `file`. Returns `{ filename, records_ingested }`.

## NLP (Leeben)

### `POST /api/nlp/extract`
Body: `{ text }`.
Returns:
```json
{
  "entities": [{ "text": "...", "label": "PERSON", "start": 0, "end": 9, "confidence": 0.8 }],
  "relations": [{ "source": "...", "target": "...", "type": "CALLED", "confidence": 0.85, "sentence": "..." }],
  "metadata": { "entity_count": 4, "relation_count": 2 }
}
```
Entity labels: `PERSON`, `PHONE`, `LOCATION`, `ORGANIZATION`, `DATE`, `CASE_ID`, `VEHICLE`, `ACCOUNT`.
Relation types: `CALLED`, `CONTACTED`, `TRANSFERRED_TO`, `VISITED`, `MET`, `OWNED`.

## Resolve (Laxitha)

### `POST /api/resolve`
Body: `{ records: [{ record_id, name?, phone?, address?, vehicle?, account?, source? }] }`.
Returns:
```json
{
  "unified_entities": [{ "unified_id": "UENT-0001", "canonical_name": "Ravi Kumar", "member_record_ids": [...], "sources": [...], "confidence": 1.0 }],
  "merge_candidates": [{ "entities_to_merge": ["a", "b"], "confidence": 0.92, "reasons": ["exact phone match"], "status": "auto_merged" }]
}
```

## Graph (Sivakesav)

### `GET /api/graph/centrality/{entity_id}`
Returns `{ id, degree }`.

### `GET /api/graph/community-detection`
Returns `{ communities: [{ community_id, members: [...] }] }` (greedy modularity over the full graph).

### `GET /api/graph/shortest-path?from=X&to=Y`
Returns `{ from, to, found, node_path, rel_path, hops }`.

### `GET /api/graph/pagerank`
Returns `{ ranked: [{ entity_id, score }] }`.

### `GET /api/timeline/{entity_id}`
Returns `{ entity_id, events: [{ timestamp, relation_type, other_id, other_name, source, confidence }] }`.

## Evidence

### `GET /api/evidence/{relationship_id}`
Returns the list of `EvidenceRecord`s backing that graph relationship:
`{ id, relationship_id, source_type, confidence, verification_status }`.

## Priority & leads

### `GET /api/priority/top?limit=10`
Returns `{ entities: [{ entity_id, score, breakdown }] }`, breakdown keys:
`network, cross_case, evidence, temporal, diversity, anomaly`.

### `GET /api/priority/{entity_id}`
Returns `{ entity_id, score, breakdown }` for one entity.

### `POST /api/leads/generate?limit=10`
Generates and persists leads from the current top-priority entities.
Returns a list of `{ id, entity_id, score, reason, recommended_action, status }`.

### `PATCH /api/leads/{lead_id}/verify`
Body: `{ approved: bool, notes?: string }`.
Returns the updated lead with `status: "verified" | "rejected"`.

## Explain & query

### `POST /api/explain/{entity_id}`
Returns `{ entity_id, explanation, priority }` — a natural-language
rationale for why the entity is significant.

### `POST /api/query`
Body: `{ question }`. Naive NL→Cypher template match.
Returns `{ matched_intent, cypher, params }`.

## Reports

### `GET /api/reports/{case_id}`
Assembles the case Intelligence Report: `{ case_id, network_analysis, investigative_leads, generated_by }`.
