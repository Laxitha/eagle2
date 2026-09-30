"""
Bridges the backend to the sibling nlp/ package (Leeben's extraction +
Laxitha's resolution code), which is intentionally standalone/importable
without the FastAPI app so it can be unit-tested and run offline.
"""
import sys
from pathlib import Path

_NLP_DIR = Path(__file__).resolve().parents[3] / "nlp"
if str(_NLP_DIR) not in sys.path:
    sys.path.insert(0, str(_NLP_DIR))
