"""
CaseFlow — Entity resolution (fuzzy matching + deduplication).

Decides whether two records ("Ravi Kumar" from a CDR file, "R. Kumar" from a
vehicle file) refer to the same real-world entity. Combines name similarity
(RapidFuzz + phonetic), phone/account exact-match after normalization, and
location similarity into a single weighted confidence score, then buckets
pairs into AUTO_MERGE / FLAG_FOR_REVIEW / SEPARATE.

Uses a blocking strategy (first letter + phone prefix + location) so we
never do an O(n^2) all-pairs comparison over the full dataset.
"""
from dataclasses import dataclass, field
from itertools import combinations
from typing import Iterable

from rapidfuzz import fuzz
import phonetics

from normalizer import normalize_address, normalize_name, normalize_phone

AUTO_MERGE_THRESHOLD = 0.90
REVIEW_THRESHOLD = 0.70

WEIGHTS = {"name": 0.30, "phone": 0.25, "location": 0.20, "other": 0.25}


@dataclass
class EntityRecord:
    record_id: str
    name: str = ""
    phone: str = ""
    address: str = ""
    vehicle: str = ""
    account: str = ""
    source: str = ""


@dataclass
class ResolutionResult:
    record_a: str
    record_b: str
    score: float
    decision: str  # AUTO_MERGE | FLAG_FOR_REVIEW | SEPARATE
    reasons: list = field(default_factory=list)


def name_similarity(name1: str, name2: str) -> float:
    """RapidFuzz token-sort + phonetic (metaphone) blend, 0.0-1.0."""
    n1, n2 = normalize_name(name1), normalize_name(name2)
    if not n1 or not n2:
        return 0.0
    if n1 == n2:
        return 1.0

    ratio = fuzz.ratio(n1, n2) / 100.0
    token_sort = fuzz.token_sort_ratio(n1, n2) / 100.0

    try:
        phon1 = phonetics.metaphone(n1.replace(" ", ""))
        phon2 = phonetics.metaphone(n2.replace(" ", ""))
        phon_match = 1.0 if phon1 == phon2 and phon1 else 0.0
    except Exception:
        phon_match = 0.0

    return max(ratio, token_sort) * 0.7 + phon_match * 0.3


def phone_similarity(phone1: str, phone2: str) -> float:
    p1, p2 = normalize_phone(phone1), normalize_phone(phone2)
    if not p1 or not p2:
        return 0.0
    return 1.0 if p1 == p2 else 0.0


def location_similarity(addr1: str, addr2: str) -> float:
    a1, a2 = normalize_address(addr1), normalize_address(addr2)
    if not a1 or not a2:
        return 0.0
    return fuzz.token_set_ratio(a1, a2) / 100.0


def other_similarity(a: EntityRecord, b: EntityRecord) -> float:
    """Account / vehicle exact-match after normalization."""
    scores = []
    if a.account and b.account:
        scores.append(1.0 if a.account == b.account else 0.0)
    if a.vehicle and b.vehicle:
        scores.append(1.0 if a.vehicle == b.vehicle else 0.0)
    return max(scores) if scores else 0.0


def resolve_entities(record1: EntityRecord, record2: EntityRecord) -> ResolutionResult:
    name_sim = name_similarity(record1.name, record2.name)
    phone_sim = phone_similarity(record1.phone, record2.phone)
    loc_sim = location_similarity(record1.address, record2.address)
    other_sim = other_similarity(record1, record2)

    # Redistribute weight away from dimensions that aren't measurable for
    # this pair (e.g. no account/vehicle on either record) — otherwise an
    # exact phone+address+name match can never clear AUTO_MERGE just
    # because neither record carries an account number.
    has_name = bool(normalize_name(record1.name) and normalize_name(record2.name))
    has_phone = bool(normalize_phone(record1.phone) and normalize_phone(record2.phone))
    has_location = bool(normalize_address(record1.address) and normalize_address(record2.address))
    has_other = bool((record1.account and record2.account) or (record1.vehicle and record2.vehicle))

    active = {
        "name": has_name, "phone": has_phone, "location": has_location, "other": has_other,
    }
    active_weight_total = sum(WEIGHTS[k] for k, on in active.items() if on)
    if active_weight_total == 0:
        score = 0.0
    else:
        norm = {k: WEIGHTS[k] / active_weight_total for k in WEIGHTS}
        score = (
            (name_sim * norm["name"] if has_name else 0.0)
            + (phone_sim * norm["phone"] if has_phone else 0.0)
            + (loc_sim * norm["location"] if has_location else 0.0)
            + (other_sim * norm["other"] if has_other else 0.0)
        )

    if score >= AUTO_MERGE_THRESHOLD:
        decision = "AUTO_MERGE"
    elif score >= REVIEW_THRESHOLD:
        decision = "FLAG_FOR_REVIEW"
    else:
        decision = "SEPARATE"

    reasons = []
    if name_sim > 0.8:
        reasons.append(f"name similarity {name_sim:.2f}")
    if phone_sim == 1.0:
        reasons.append("exact phone match")
    if loc_sim > 0.7:
        reasons.append(f"address similarity {loc_sim:.2f}")
    if other_sim == 1.0:
        reasons.append("exact account/vehicle match")
    if not reasons:
        reasons.append("no strong signals")

    return ResolutionResult(record1.record_id, record2.record_id, round(score, 4), decision, reasons)


# ---------------------------------------------------------------------------
# Blocking + full dedup pipeline
# ---------------------------------------------------------------------------

def _block_key(record: EntityRecord) -> tuple:
    name = normalize_name(record.name)
    first_letter = name[0] if name else "?"
    phone_prefix = normalize_phone(record.phone)[:3] if record.phone else "?"
    addr = normalize_address(record.address)
    location_token = addr.split()[-1] if addr else "?"
    return (first_letter, phone_prefix, location_token)


def _candidate_pairs(records: list[EntityRecord]) -> Iterable[tuple[EntityRecord, EntityRecord]]:
    """Only compare records that share at least one blocking dimension —
    avoids the O(n^2) all-pairs comparison over the full dataset."""
    by_first_letter: dict = {}
    by_phone_prefix: dict = {}
    by_location: dict = {}

    for r in records:
        fl, pp, loc = _block_key(r)
        by_first_letter.setdefault(fl, []).append(r)
        if pp != "?":
            by_phone_prefix.setdefault(pp, []).append(r)
        if loc != "?":
            by_location.setdefault(loc, []).append(r)

    seen_pairs = set()
    for bucket in (by_first_letter, by_phone_prefix, by_location):
        for group in bucket.values():
            if len(group) < 2 or len(group) > 200:
                continue
            for a, b in combinations(group, 2):
                key = tuple(sorted((a.record_id, b.record_id)))
                if key in seen_pairs:
                    continue
                seen_pairs.add(key)
                yield a, b


def deduplicate(records: list[EntityRecord]) -> dict:
    """Runs blocking + pairwise resolution over `records`.

    Returns {"auto_merge": [...], "flagged": [...], "separate": [...]}
    where each entry is a ResolutionResult.
    """
    auto_merge, flagged, separate = [], [], []
    for a, b in _candidate_pairs(records):
        result = resolve_entities(a, b)
        if result.decision == "AUTO_MERGE":
            auto_merge.append(result)
        elif result.decision == "FLAG_FOR_REVIEW":
            flagged.append(result)
        else:
            separate.append(result)
    return {"auto_merge": auto_merge, "flagged": flagged, "separate": separate}
