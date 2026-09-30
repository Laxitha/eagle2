"""
Bridges the backend to the NLP extraction layer.

On Vercel: calls the nlp service via the NLP_URL binding (injected by Vercel).
Locally: imports the sibling nlp/ package directly via sys.path.
"""
import os
import sys
from pathlib import Path

NLP_URL = os.getenv("NLP_URL")

if not NLP_URL:
    _NLP_DIR = Path(__file__).resolve().parents[3] / "nlp"
    if str(_NLP_DIR) not in sys.path:
        sys.path.insert(0, str(_NLP_DIR))
