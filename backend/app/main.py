from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.postgres import Base, engine
from app.routers import (
    auth_router,
    evidence,
    explain,
    graph,
    ingest,
    leads,
    nlp_router,
    priority,
    reports,
    resolve,
    timeline,
)

app = FastAPI(title="EAGLE API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth_router.router)
app.include_router(ingest.router)
app.include_router(graph.router)
app.include_router(timeline.router)
app.include_router(evidence.router)
app.include_router(priority.router)
app.include_router(leads.router)
app.include_router(resolve.router)
app.include_router(nlp_router.router)
app.include_router(explain.router)
app.include_router(reports.router)

# CaseFlow agent layer. Mounted under /agent. Guarded so a problem in the
# agent package can never take down the core API, and the repo root is added
# to the path because the backend runs with backend/ as its import root.
try:
    import sys as _sys
    from pathlib import Path as _Path
    _root = str(_Path(__file__).resolve().parents[2])
    if _root not in _sys.path:
        _sys.path.insert(0, _root)
    from entity_resolution.agent.agent_api import router as agent_router
    app.include_router(agent_router)
except Exception as _exc:  # pragma: no cover - integration seam
    import logging as _logging
    _logging.getLogger("eagle").warning("agent router not mounted: %s", _exc)
