# CaseFlow User Guide

## 1. Sign in
Log in at `/login` with an investigator account (create one via
`POST /api/auth/register` if none exists yet).

## 2. Upload case data
Go to **Upload** and drop CDR/financial/vehicle CSVs, or FIR reports (PDF/text).
CaseFlow normalizes phone numbers, names, addresses, vehicle plates, and
account numbers automatically, then resolves duplicate mentions of the same
person across files.

## 3. Explore the graph
The **Graph** page shows every entity as a colored node — Person (blue),
Phone (green), Case (red), Vehicle (orange), Account (purple), Location
(yellow) — connected by relationships like `CALLED`, `TRANSFERRED`,
`VISITED`. Click a node to open its detail panel: connections, mini
network, and evidence. Use the type filters and search bar to narrow the
view on a large graph.

## 4. Review leads
The **Leads** page ranks entities by priority score (network centrality +
cross-case presence + evidence strength + recency + connection diversity +
anomaly signal). Each lead card shows *why* it was flagged and a
recommended action. **Verify** to confirm a lead is worth acting on, or
**Reject** to dismiss it — every decision is logged.

## 5. Generate a report
The **Reports** page assembles a case Intelligence Report — overview,
network analysis, timeline, evidence summary, leads, investigator notes —
ready to export.

## Interpreting confidence scores

Every relationship in the graph carries a confidence score from its source:
CDR/financial matches from structured data score high (0.9+); NLP-extracted
relationships from free text score lower (0.6-0.85) since they depend on
extraction accuracy. Entity resolution follows the same logic — an exact
phone + address match auto-merges; a name-only fuzzy match gets flagged for
human review rather than merged automatically.

## Demo mode

The frontend ships with mock data (`frontend/lib/mockData.ts`) mirroring
the synthetic dataset's hidden connector chain, so the UI is fully
walkable before the backend is wired up.
