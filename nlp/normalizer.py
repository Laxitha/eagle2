"""
EAGLE — Normalization utilities.

Converts messy real-world investigation data (phones, names, addresses,
vehicle numbers, account numbers) into canonical forms so that the same
entity written differently across sources compares equal.
"""
import re

INDIAN_TITLES = {
    "shri", "smt", "sri", "sri.", "shri.", "smt.", "mr", "mr.", "mrs", "mrs.",
    "ms", "ms.", "dr", "dr.", "miss", "kumari", "km",
}

_WS_RE = re.compile(r"\s+")
_NON_ALNUM_SPACE_RE = re.compile(r"[^a-z0-9\s]")
_NON_DIGIT_RE = re.compile(r"\D")


def normalize_phone(raw: str) -> str:
    """'+91 98765 43210' / '091-98765-43210' -> '9876543210' (last 10 digits)."""
    if not raw:
        return ""
    digits = _NON_DIGIT_RE.sub("", raw)
    if len(digits) > 10:
        digits = digits[-10:]
    return digits


def normalize_name(raw: str) -> str:
    """'Shri. RAVI KUMAR' -> 'ravi kumar' (lowercase, titles stripped, whitespace collapsed)."""
    if not raw:
        return ""
    name = raw.strip().lower()
    name = name.replace(".", " ")
    tokens = [t for t in _WS_RE.split(name) if t and t not in INDIAN_TITLES]
    return " ".join(tokens)


def normalize_address(raw: str) -> str:
    """'15, MG Rd' -> '15 mg road' (lowercase, common abbreviations expanded)."""
    if not raw:
        return ""
    addr = raw.strip().lower()
    addr = addr.replace(",", " ")
    abbrev = {
        r"\brd\b": "road",
        r"\bst\b": "street",
        r"\bnagar\b": "nagar",
        r"\bapt\b": "apartment",
        r"\bblk\b": "block",
        r"\bno\.\b": "number",
    }
    for pattern, repl in abbrev.items():
        addr = re.sub(pattern, repl, addr)
    addr = _NON_ALNUM_SPACE_RE.sub(" ", addr)
    return _WS_RE.sub(" ", addr).strip()


def normalize_vehicle(raw: str) -> str:
    """'TN 01 AB 1234' -> 'TN01AB1234' (uppercase, no spaces)."""
    if not raw:
        return ""
    return re.sub(r"\s+", "", raw.strip().upper())


def normalize_account(raw: str) -> str:
    """'1234 5678 9012' -> '123456789012' (digits only)."""
    if not raw:
        return ""
    return _NON_DIGIT_RE.sub("", raw)
