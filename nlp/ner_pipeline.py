"""
EAGLE — Named Entity Recognition pipeline (Leeben's Day 1 deliverable).

Extracts PERSON, PHONE, LOCATION, ORGANIZATION, DATE, CASE_ID, VEHICLE,
ACCOUNT entities from free text using spaCy's statistical NER for the
general-purpose labels, plus direct regex matching over the raw text for
the domain-specific patterns (phone numbers, FIR case IDs, Indian vehicle
plates, bank account numbers).

Regex extraction runs over raw text rather than spaCy's EntityRuler
because these patterns span multiple tokens (e.g. "+91 98765 43210" is
three separate tokens) — a single-token EntityRuler TEXT/REGEX pattern
only ever matches one token at a time and silently misses them.
"""
import re
from dataclasses import dataclass

import spacy

# Regex patterns are matched in this order; earlier matches claim their
# span so later, looser patterns (ACCOUNT) don't re-match the same digits.
PHONE_PATTERN = r"(\+?91[\s-]?)?\d{5}[\s-]?\d{5}"
CASE_ID_PATTERN = r"(FIR|Case|CR)[\s-]?[-/]?\s?\d+"
VEHICLE_PATTERN = r"[A-Z]{2}\s?\d{2}\s?[A-Z]{1,3}\s?\d{4}"
ACCOUNT_PATTERN = r"\d{9,18}"

_REGEX_RULES = [
    ("PHONE", PHONE_PATTERN, 0.95),
    ("CASE_ID", CASE_ID_PATTERN, 0.95),
    ("VEHICLE", VEHICLE_PATTERN, 0.95),
    ("ACCOUNT", ACCOUNT_PATTERN, 0.6),
]

_SPACY_LABEL_MAP = {
    "PERSON": "PERSON",
    "GPE": "LOCATION",
    "LOC": "LOCATION",
    "ORG": "ORGANIZATION",
    "DATE": "DATE",
}

_nlp = None


def _get_pipeline():
    global _nlp
    if _nlp is None:
        _nlp = spacy.load("en_core_web_lg")
    return _nlp


@dataclass
class Entity:
    text: str
    label: str
    start: int
    end: int
    confidence: float


def _overlaps(start: int, end: int, spans: list[tuple[int, int]]) -> bool:
    return any(start < s_end and end > s_start for s_start, s_end in spans)


def _extract_regex_entities(text: str) -> list[Entity]:
    entities: list[Entity] = []
    claimed: list[tuple[int, int]] = []
    for label, pattern, confidence in _REGEX_RULES:
        for m in re.finditer(pattern, text):
            start, end = m.start(), m.end()
            if _overlaps(start, end, claimed):
                continue
            entities.append(Entity(m.group(), label, start, end, confidence))
            claimed.append((start, end))
    return entities, claimed


def extract_entities(text: str) -> list[Entity]:
    """Runs regex extraction (PHONE/CASE_ID/VEHICLE/ACCOUNT) plus spaCy NER
    (PERSON/LOCATION/ORGANIZATION/DATE) over `text`. Regex matches take
    priority on overlap since they're deterministic pattern hits.
    Returns a list of Entity(text, label, start, end, confidence)."""
    if not text or not text.strip():
        return []

    entities, claimed_spans = _extract_regex_entities(text)

    nlp = _get_pipeline()
    doc = nlp(text)
    for ent in doc.ents:
        label = _SPACY_LABEL_MAP.get(ent.label_)
        if label is None:
            continue
        if _overlaps(ent.start_char, ent.end_char, claimed_spans):
            continue
        entities.append(Entity(ent.text, label, ent.start_char, ent.end_char, 0.80))

    entities.sort(key=lambda e: e.start)
    return entities


if __name__ == "__main__":
    sample = (
        "Shri Ravi Kumar (phone +91 98765 43210) was seen with Suresh Reddy "
        "near MG Road, Chennai on 02-06-2026. Case FIR-101 vehicle TN 09 AB 4521."
    )
    for e in extract_entities(sample):
        print(e)
