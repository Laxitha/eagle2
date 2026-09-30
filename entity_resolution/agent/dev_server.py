"""
dev_server.py — a minimal host for the /agent API during frontend development.

The agent router is already mounted in backend/app/main.py for production, but
that app also boots Postgres, auth and the graph routers. When you only want to
work on the AI Agent page, this serves the exact same router on its own, with
CORS open for the Next.js dev server, and needs no database:

    python -m entity_resolution.agent.dev_server        # -> http://localhost:8000

The frontend's NEXT_PUBLIC_API_URL defaults to http://localhost:8000, so the
AI Agent page talks to this without any change. The resolver and (when up) the
graph still bind exactly as they do in the full backend.
"""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .agent_api import router as agent_router
from .webstore import router as data_router

app = FastAPI(title="CaseFlow (dev)", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agent_router)
app.include_router(data_router)


@app.get("/health")
def health() -> dict:
    from . import tools
    return {"status": "ok", "backends": tools.backends()}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1",
                port=int(os.getenv("AGENT_DEV_PORT", "8000")))
