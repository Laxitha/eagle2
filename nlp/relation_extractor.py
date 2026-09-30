"""
EAGLE — Relation extraction pipeline (Leeben's Day 2 deliverable).

Given text and its extracted entities (from ner_pipeline.extract_entities),
finds relationships between PERSON/LOCATION entities: CALLED, CONTACTED,
TRANSFERRED_TO, VISITED. Uses surface patterns first (fast, high precision)
and falls back to dependency-parse subject->verb->object matching for
sentences the patterns miss.
"""
import re
from dataclasses import dataclass

import spacy

from ner_pipeline import Entity, extract_entities, _get_pipeline

# (verb-phrase regex, relation type) — matched against the raw text directly
# rather than "the gap between two adjacent entities", since real prose
# routinely has a date/location entity sitting between subject and object
# (e.g. "Ravi Kumar contacted ... on 04-06-2026 ... Suresh Reddy").
_SURFACE_PATTERNS = [
    (re.compile(r"\bcalled\b", re.I), "CALLED"),
    (re.compile(r"\bcontact(?:ed|ing)?\b", re.I), "CONTACTED"),
    (re.compile(r"\b(transferred|transferring|transfer to|sent funds to|sent money to)\b", re.I), "TRANSFERRED_TO"),
    (re.compile(r"\bvisit(?:ed|ing)?\b", re.I), "VISITED"),
    (re.compile(r"\bmet\b|\bmeeting\b", re.I), "MET"),
    (re.compile(r"\b(owns|registered to|owned by)\b", re.I), "OWNED"),
]

# Max characters allowed between subject/verb and verb/object — keeps
# matches within roughly one clause without requiring exact adjacency.
_MAX_SUBJECT_GAP = 80
_MAX_OBJECT_GAP = 60

_VERB_TO_RELATION = {
    "call": "CALLED", "phone": "CALLED", "contact": "CONTACTED",
    "transfer": "TRANSFERRED_TO", "send": "TRANSFERRED_TO", "visit": "VISITED",
    "meet": "MET", "own": "OWNED", "register": "OWNED",
}


@dataclass
class Relation:
    source: str
    target: str
    type: str
    confidence: float
    sentence: str


def _entities_in_span(entities: list[Entity], start: int, end: int) -> list[Entity]:
    return [e for e in entities if e.start >= start and e.end <= end]


def _surface_pattern_relations(text: str, entities: list[Entity]) -> list[Relation]:
    """For each verb-phrase match, takes the nearest PERSON entity ending
    before it as the subject and the nearest entity of the expected type
    starting after it as the object, each within a max character gap.
    Verb-centered rather than adjacent-entity-pair-centered so an
    intervening date/location entity doesn't break the match."""
    relations = []
    people = [e for e in entities if e.label == "PERSON"]
    locations = [e for e in entities if e.label == "LOCATION"]

    for pattern, rel_type in _SURFACE_PATTERNS:
        wanted = locations if rel_type == "VISITED" else people
        for m in pattern.finditer(text):
            verb_start, verb_end = m.start(), m.end()

            subject = max(
                (e for e in people if e.end <= verb_start and verb_start - e.end <= _MAX_SUBJECT_GAP),
                key=lambda e: e.end, default=None,
            )
            if subject is None:
                continue

            obj = min(
                (e for e in wanted if e.start >= verb_end and e.start - verb_end <= _MAX_OBJECT_GAP),
                key=lambda e: e.start, default=None,
            )
            if obj is None or obj.text == subject.text:
                continue

            sentence = text[max(0, subject.start - 15):min(len(text), obj.end + 15)]
            relations.append(Relation(subject.text, obj.text, rel_type, 0.8, sentence.strip()))
    return relations


def _dependency_parse_relations(text: str, entities: list[Entity]) -> list[Relation]:
    """Fallback: subject -> verb -> object dependency matching for sentences
    the surface patterns miss (different phrasing, passive voice, etc)."""
    nlp = _get_pipeline()
    doc = nlp(text)
    relations = []

    def entity_for_token(token):
        for e in entities:
            if e.start <= token.idx < e.end:
                return e
        return None

    for sent in doc.sents:
        for token in sent:
            if token.pos_ != "VERB":
                continue
            lemma = token.lemma_.lower()
            rel_type = _VERB_TO_RELATION.get(lemma)
            if not rel_type:
                continue

            subj = next((c for c in token.children if c.dep_ in ("nsubj", "nsubjpass")), None)
            obj = next((c for c in token.children if c.dep_ in ("dobj", "pobj", "attr")), None)
            if obj is None:
                for c in token.children:
                    if c.dep_ == "prep":
                        obj = next((gc for gc in c.children if gc.dep_ == "pobj"), None)
                        if obj:
                            break
            if subj is None or obj is None:
                continue

            subj_ent = entity_for_token(subj)
            obj_ent = entity_for_token(obj)
            if subj_ent is None or obj_ent is None or subj_ent.label != "PERSON":
                continue

            relations.append(Relation(subj_ent.text, obj_ent.text, rel_type, 0.65, sent.text.strip()))

    return relations


def extract_relations(text: str, entities: list[Entity] | None = None) -> list[Relation]:
    """Extracts relationships from `text` given its entities (auto-extracted
    if not passed). Combines surface-pattern matches (higher confidence)
    with dependency-parse fallback, deduped by (source, target, type)."""
    if not text or not text.strip():
        return []
    if entities is None:
        entities = extract_entities(text)

    relations = _surface_pattern_relations(text, entities)
    seen = {(r.source, r.target, r.type) for r in relations}

    for r in _dependency_parse_relations(text, entities):
        key = (r.source, r.target, r.type)
        if key not in seen:
            relations.append(r)
            seen.add(key)

    return relations


if __name__ == "__main__":
    sample = "Ravi Kumar called Suresh Reddy on 04-06-2026. Suresh Reddy visited Marine Drive, Kochi."
    ents = extract_entities(sample)
    for r in extract_relations(sample, ents):
        print(r)
