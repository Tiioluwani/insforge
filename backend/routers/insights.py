"""
Insights router
POST /api/insights  — generate AI insight via InsForge AI Model Gateway (SSE stream)
GET  /api/insights  — return persisted insight history
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections import Counter
from typing import Annotated, AsyncIterator

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from lib.insforge import get_client
from lib.types import AiInsight, InsightRequest, TimeRange

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/insights", tags=["insights"])

_INTERVAL_MAP: dict[str, str] = {
    "1h": "1 hour",
    "24h": "24 hours",
    "7d": "7 days",
}

_INTERVAL_LABEL: dict[str, str] = {
    "1h": "the last hour",
    "24h": "the last 24 hours",
    "7d": "the last 7 days",
}

SYSTEM_PROMPT = """You are an expert product analytics AI. Analyze the provided metrics and return a structured insight.

Format your response as:
TITLE: <short title, max 10 words>

<insight body: 3-5 sentences covering traffic patterns, top event trends, any notable anomalies, and one actionable recommendation. Be specific with numbers. Avoid generic filler phrases.>"""


async def _build_context(time_range: TimeRange) -> tuple[str, dict]:
    """Fetch analytics data from InsForge Postgres and format it for the AI prompt."""
    interval = _INTERVAL_MAP.get(time_range, "24 hours")
    client = get_client()
    db = client.database

    since = f"NOW() - INTERVAL '{interval}'"

    total_res, by_name_res, timeseries_res = await asyncio.gather(
        db.from_("events").select("*", count="exact").gte("created_at", since).execute(),
        db.from_("events").select("event_name").gte("created_at", since).execute(),
        db.from_("event_hourly_stats").select("bucket_start,count").gte("bucket_start", since).order("bucket_start").execute(),
        return_exceptions=True,
    )

    total = total_res.count if not isinstance(total_res, Exception) else 0

    name_counter: Counter[str] = Counter()
    if not isinstance(by_name_res, Exception):
        for row in by_name_res.data or []:
            name_counter[row["event_name"]] += 1

    top_events_str = ", ".join(
        f"{name}: {cnt}" for name, cnt in name_counter.most_common(10)
    ) or "No events in this period"

    hourly_lines = []
    if not isinstance(timeseries_res, Exception):
        for row in (timeseries_res.data or [])[-24:]:  # cap to last 24 buckets
            hourly_lines.append(f"{row['bucket_start'][:16]}: {row['count']}")
    hourly_str = "\n".join(hourly_lines) or "No hourly data available"

    user_message = (
        f"Analytics data for {_INTERVAL_LABEL[time_range]}:\n\n"
        f"Total events: {total}\n\n"
        f"Event breakdown:\n{top_events_str}\n\n"
        f"Hourly event counts:\n{hourly_str}\n\n"
        "Provide a concise analytical insight."
    )

    metadata = {"total_events": total, "top_events": dict(name_counter.most_common(10))}
    return user_message, metadata


async def _stream_insight(time_range: TimeRange) -> AsyncIterator[str]:
    """
    Core generator that:
    1. Fetches analytics context from InsForge Postgres
    2. Streams AI response from InsForge AI Model Gateway
    3. Persists the completed insight to InsForge Postgres
    4. Emits SSE-formatted chunks throughout
    """
    client = get_client()

    def sse(data: dict) -> str:
        return f"data: {json.dumps(data)}\n\n"

    try:
        user_message, metadata = await _build_context(time_range)

        full_content = ""
        title = "AI Analytics Insight"

        # Stream from InsForge AI Model Gateway
        async for delta in client.ai.stream(
            model="anthropic/claude-haiku-4-5-20251001",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.6,
        ):
            full_content += delta
            yield sse({"chunk": delta})

        # Parse title from response
        lines = full_content.splitlines()
        title_line = next((l for l in lines if l.startswith("TITLE:")), None)
        if title_line:
            title = title_line.replace("TITLE:", "").strip()
            body_lines = [l for l in lines if not l.startswith("TITLE:")]
            full_content = "\n".join(body_lines).strip()

        # Persist insight to InsForge Postgres
        insert_result = await (
            client.database
            .from_("ai_insights")
            .insert(
                {
                    "insight_type": "trend",
                    "title": title,
                    "content": full_content,
                    "time_range": time_range,
                    "metadata": metadata,
                }
            )
            .execute()
        )

        saved = insert_result.data[0] if insert_result.data else None
        yield sse({"done": True, "insight": saved})

    except Exception as exc:
        logger.exception("Insight stream failed")
        yield sse({"error": str(exc)})


@router.post("")
async def generate_insight(body: InsightRequest) -> StreamingResponse:
    """
    Stream an AI-generated insight about current analytics data.
    Response is `text/event-stream` (Server-Sent Events).
    """
    return StreamingResponse(
        _stream_insight(body.time_range),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


@router.get("")
async def list_insights(
    limit: Annotated[int, Query(ge=1, le=20)] = 5,
) -> dict:
    """Return the most recent persisted AI insights."""
    result = (
        await get_client()
        .database.from_("ai_insights")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return {"data": result.data or []}
