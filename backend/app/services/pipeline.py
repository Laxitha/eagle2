"""
End-to-end demo pipeline: reads data/*.csv, normalizes + resolves entities,
builds the Neo4j graph, and writes evidence records to Postgres. Run this
once after `docker compose up` to populate the graph for the frontend demo.
"""
from pathlib import Path

import pandas as pd
from sqlalchemy.orm import Session

from app.db.postgres import SessionLocal
from app.services import graph_builder, nlp_bridge  # noqa: F401
from app.services.evidence_engine import record_evidence

from entity_resolver import EntityRecord
from normalizer import normalize_account, normalize_name, normalize_phone, normalize_vehicle
from unified_entity import build_unified_entities

DATA_DIR = Path(__file__).resolve().parents[4] / "data"


def _load_persons_from_dataset() -> list[EntityRecord]:
    """Builds one EntityRecord per row across cdr/financial/vehicle records
    so the resolver has cross-source variants to collapse, mirroring what
    Leeben's NER output would look like once wired in."""
    records = []
    cdr = pd.read_csv(DATA_DIR / "cdr_records.csv")
    for i, row in cdr.iterrows():
        records.append(EntityRecord(record_id=f"cdr-caller-{i}", phone=row["caller"], source="cdr"))
        records.append(EntityRecord(record_id=f"cdr-receiver-{i}", phone=row["receiver"], source="cdr"))

    vehicles = pd.read_csv(DATA_DIR / "vehicle_records.csv")
    for i, row in vehicles.iterrows():
        records.append(EntityRecord(
            record_id=f"vehicle-owner-{i}", name=row["owner"], address=row["address"],
            vehicle=normalize_vehicle(row["vehicle_number"]), source="vehicle",
        ))
    return records


def run_pipeline():
    db: Session = SessionLocal()
    try:
        graph_builder.ensure_constraints()

        cases = pd.read_csv(DATA_DIR / "cases.csv")
        for _, row in cases.iterrows():
            graph_builder.upsert_node("Case", row["case_id"], {
                "description": row["description"], "status": row["status"],
                "officer": row["officer"], "location": row["location"], "category": row["category"],
            })

        records = _load_persons_from_dataset()
        unified = build_unified_entities(records)
        graph_builder.ingest_resolved_entities([
            {"unified_id": u.unified_id, "canonical_name": u.canonical_name or u.unified_id, "sources": u.sources}
            for u in unified
        ])

        financial = pd.read_csv(DATA_DIR / "financial_records.csv")
        for _, row in financial.iterrows():
            sender = normalize_account(row["sender_acc"])
            receiver = normalize_account(row["receiver_acc"])
            graph_builder.upsert_node("Account", sender, {})
            graph_builder.upsert_node("Account", receiver, {})
            rel = graph_builder.upsert_relationship(
                "Account", sender, "Account", receiver, "TRANSFERRED",
                source="financial_records.csv", confidence=0.9, timestamp=row["timestamp"],
                extra={"amount": float(row["amount"]), "bank": row["bank"]},
            )
            if rel:
                record_evidence(db, rel["relationship_id"], "financial", 0.9)

        print(f"Pipeline complete: {len(cases)} cases, {len(unified)} unified entities, "
              f"{len(financial)} financial transfers ingested.")
    finally:
        db.close()


if __name__ == "__main__":
    run_pipeline()
