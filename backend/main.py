"""
InsForge Analytics Dashboard — FastAPI Backend
===============================================
Starts the API server. All business logic lives in routers/.

Run:
  uvicorn main:app --reload --port 8000
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings, SettingsConfigDict

from lib.insforge import get_client
from routers import events, insights, metrics, simulate

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)


class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    allowed_origins: str = "http://localhost:3000"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Warm up InsForge realtime connection on startup."""
    try:
        client = get_client()
        await client.realtime.connect()
        await client.realtime.subscribe("analytics:events")
        logging.getLogger(__name__).info("InsForge Realtime connected ✓")
    except Exception as exc:
        logging.getLogger(__name__).warning(
            "Realtime pre-connect failed (will retry on demand): %s", exc
        )
    yield
    # Graceful teardown
    await get_client().aclose()


app = FastAPI(
    title="InsForge Analytics Dashboard API",
    description=(
        "Real-time analytics backend powered by InsForge — "
        "Postgres, AI Model Gateway, and Realtime in one platform."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
_settings = AppSettings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.allowed_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(events.router)
app.include_router(metrics.router)
app.include_router(insights.router)
app.include_router(simulate.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
