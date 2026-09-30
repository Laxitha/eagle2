"""
Vercel entry point — re-exports the CaseFlow dev server's FastAPI app.

The dev server provides the /agent/* and /api/* routes using an in-memory
case store (no database required), which is ideal for Vercel's serverless
environment.
"""

from entity_resolution.agent.dev_server import app
