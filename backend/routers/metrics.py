"""
Metrics router
GET /api/metrics?range=24h  — aggregated analytics metrics
"""

from __future__ import annotations

import asyncio
import logging
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Query

from lib.insforge import get_client
from lib.types import (
    EventNameCount,
    MetricsResponse,
    PageCount,
    TimeRange,
    TimeSeriesPoint,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/metrics", tags=["metrics"])

_TIMEDELTA_MAP: dict[str, timedelta] = {
    "1h": timedelta(hours=1),
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
}


@router.get("")
async def get_metrics(
    range: Annotated[TimeRange, Query()] = "24h",
) -> dict:
    """
    Return aggregated metrics for the requested time window.
    All aggregation happens in-process after fetching from InsForge Postgres
    because PostgREST does not expose GROUP BY directly.
    """
    client = get_client()
    db = client.database

    delta = _TIMEDELTA_MAP.get(range, timedelta(hours=24))
    since_filter = (datetime.now(timezone.utc) - delta).isoformat()

    # Run all queries concurrently
    (
        total_res,
        users_res,
        sessions_res,
        by_name_res,
        timeseries_res,
        pages_res,
    ) = await asyncio.gather(
        db.from_("events").select("*", count="exact").gte("created_at", since_filter).execute(),
        db.from_("events").select("user_id", count="exact").gte("created_at", since_filter).not_.is_("user_id", "null").execute(),
        db.from_("events").select("session_id", count="exact").gte("created_at", since_filter).not_.is_("session_id", "null").execute(),
        db.from_("events").select("event_name").gte("created_at", since_filter).execute(),
        db.from_("event_hourly_stats").select("bucket_start,count").gte("bucket_start", since_filter).order("bucket_start").execute(),
        db.from_("events").select("page").gte("created_at", since_filter).not_.is_("page", "null").execute(),
        return_exceptions=True,
    )

    # Aggregate event counts by name
    name_counter: Counter[str] = Counter()
    if not isinstance(by_name_res, Exception):
        for row in by_name_res.data or []:
            name_counter[row["event_name"]] += 1

    events_by_name = [
        EventNameCount(event_name=name, count=cnt)
        for name, cnt in name_counter.most_common()
    ]

    # Aggregate page counts
    page_counter: Counter[str] = Counter()
    if not isinstance(pages_res, Exception):
        for row in pages_res.data or []:
            if row.get("page"):
                page_counter[row["page"]] += 1

    top_pages = [
        PageCount(page=page, count=cnt)
        for page, cnt in page_counter.most_common(10)
    ]

    # Time-series from hourly rollup
    time_series: list[TimeSeriesPoint] = []
    if not isinstance(timeseries_res, Exception):
        for row in timeseries_res.data or []:
            time_series.append(
                TimeSeriesPoint(bucket_start=row["bucket_start"], count=row["count"])
            )

    response = MetricsResponse(
        total_events=total_res.count if not isinstance(total_res, Exception) else 0,
        unique_users=users_res.count if not isinstance(users_res, Exception) else 0,
        unique_sessions=sessions_res.count if not isinstance(sessions_res, Exception) else 0,
        events_by_name=events_by_name,
        time_series=time_series,
        top_pages=top_pages,
    )

    return {"data": response.model_dump()}
