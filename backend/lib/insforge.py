"""
InsForge Python Client
======================
Wraps InsForge's three core services for server-side use:

  • Database  — PostgREST-compatible via `postgrest-py`
  • AI        — OpenAI-compatible streaming via `httpx` (SSE)
  • Realtime  — Socket.IO publish via `python-socketio`

URL layout (confirmed from @insforge/sdk source):
  Database records : {base}/api/database/records
  Database RPC     : {base}/api/database/rpc
  AI completions   : {base}/api/ai/chat/completion
  Realtime (WS)    : {base}   (Socket.IO root)
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from functools import lru_cache
from typing import Any

import httpx
import socketio
from postgrest import AsyncPostgrestClient
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


# ─── Settings ─────────────────────────────────────────────────────────────────

class InsForgeSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    insforge_base_url: str = "http://localhost:7130"
    insforge_anon_key: str = ""
    insforge_service_key: str = ""

    @property
    def api_key(self) -> str:
        """Prefer service key on the server side."""
        return self.insforge_service_key or self.insforge_anon_key


@lru_cache
def get_settings() -> InsForgeSettings:
    return InsForgeSettings()


# ─── Database ─────────────────────────────────────────────────────────────────

class InsForgeDatabase:
    """
    Thin wrapper around `postgrest-py` pointed at InsForge's records endpoint.

    Usage:
        db = InsForgeDatabase(base_url, api_key)
        rows = await db.from_("events").select("*").order("created_at", desc=True).limit(50).execute()
        await db.from_("events").insert({...}).execute()
    """

    def __init__(self, base_url: str, api_key: str) -> None:
        records_url = f"{base_url.rstrip('/')}/api/database/records"
        self._client = AsyncPostgrestClient(
            records_url,
            headers={
                "apikey": api_key,
                "Authorization": f"Bearer {api_key}",
            },
        )

    def from_(self, table: str):
        return self._client.from_(table)

    async def rpc(self, fn: str, params: dict[str, Any] | None = None) -> Any:
        """Call a Postgres RPC function via InsForge's rpc endpoint."""
        return await self._client.rpc(fn, params or {}).execute()

    async def aclose(self) -> None:
        await self._client.aclose()


# ─── AI ───────────────────────────────────────────────────────────────────────

class InsForgeAI:
    """
    Async client for InsForge's AI Model Gateway.
    The gateway is OpenAI-compatible but exposed at a custom path.

    Supports non-streaming and Server-Sent Event streaming responses.
    """

    def __init__(self, base_url: str, api_key: str) -> None:
        self._url = f"{base_url.rstrip('/')}/api/ai/chat/completion"
        self._headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "apikey": api_key,
        }

    async def complete(
        self,
        *,
        model: str = "anthropic/claude-haiku-4-5-20251001",
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int | None = None,
        stream: bool = False,
    ) -> Any:
        """Non-streaming chat completion. Returns the full response dict."""
        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "stream": False,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(self._url, json=payload, headers=self._headers)
            resp.raise_for_status()
            return resp.json()

    async def stream(
        self,
        *,
        model: str = "anthropic/claude-haiku-4-5-20251001",
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> AsyncIterator[str]:
        """
        Streaming chat completion.
        Yields text delta strings as they arrive via SSE.

        InsForge streams SSE chunks:
          data: {"chunk": "...text..."}
          data: {"done": true, "tokenUsage": {...}}
        """
        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "stream": True,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                self._url,
                json=payload,
                headers=self._headers,
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    raw = line[len("data:"):].strip()
                    if not raw:
                        continue
                    try:
                        data = json.loads(raw)
                    except json.JSONDecodeError:
                        continue

                    if data.get("done"):
                        break
                    delta: str = data.get("chunk", "")
                    if delta:
                        yield delta


# ─── Realtime ─────────────────────────────────────────────────────────────────

class InsForgeRealtime:
    """
    Server-side Socket.IO client for publishing events to InsForge Realtime.
    The server connects as an emitter — it subscribes to a channel and
    publishes messages that all browser clients subscribed to the same
    channel will receive in real time.
    """

    def __init__(self, base_url: str, api_key: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._sio = socketio.AsyncClient(logger=False, engineio_logger=False)
        self._connected = False

    async def connect(self) -> None:
        if self._connected:
            return
        await self._sio.connect(
            self._base_url,
            transports=["websocket"],
            auth={"token": self._api_key},
        )
        self._connected = True
        logger.debug("InsForge Realtime connected")

    async def subscribe(self, channel: str) -> None:
        """Subscribe to a channel (required before publish)."""
        await self._sio.emit("realtime:subscribe", {"channel": channel})

    async def publish(self, channel: str, event: str, payload: Any) -> None:
        """Publish an event to a channel."""
        await self._sio.emit(event, {"channel": channel, "payload": payload})

    async def disconnect(self) -> None:
        if self._connected:
            await self._sio.disconnect()
            self._connected = False


# ─── Unified client ───────────────────────────────────────────────────────────

class InsForgeClient:
    """Single entry point for all InsForge services."""

    def __init__(self, base_url: str, api_key: str) -> None:
        self.database = InsForgeDatabase(base_url, api_key)
        self.ai = InsForgeAI(base_url, api_key)
        self.realtime = InsForgeRealtime(base_url, api_key)

    async def aclose(self) -> None:
        await self.database.aclose()
        await self.realtime.disconnect()


# ─── Singleton ────────────────────────────────────────────────────────────────

_client: InsForgeClient | None = None


def get_client() -> InsForgeClient:
    global _client
    if _client is None:
        s = get_settings()
        _client = InsForgeClient(s.insforge_base_url, s.api_key)
    return _client
