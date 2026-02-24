"""
Events router
POST /api/events  — ingest a raw analytics event
GET  /api/events  — fetch recent events (live feed)
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from lib.insforge import get_client
from lib.types import AnalyticsEvent, IngestEventRequest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/events", tags=["events"])

REALTIME_CHANNEL = "analytics:events"


@router.post("", status_code=201)
async def ingest_event(body: IngestEventRequest) -> dict:
    """
    Persist one analytics event to InsForge Postgres, update the hourly
    rollup bucket, then broadcast a realtime notification so every live
    dashboard updates instantly.
    """
    client = get_client()

    # 1. Insert the raw event
    result = await (
        client.database
        .from_("events")
        .insert(
            {
                "event_name": body.event_name,
                "user_id": body.user_id,
                "session_id": body.session_id,
                "page": body.page,
                "referrer": body.referrer,
                "properties": body.properties,
            }
        )
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to insert event")

    event = result.data[0]

    # 2. Update hourly rollup bucket
    try:
        await client.database.rpc(
            "upsert_hourly_stat",
            {"p_event_name": body.event_name, "p_ts": event["created_at"]},
        )
    except Exception as exc:
        logger.warning("upsert_hourly_stat failed: %s", exc)

    # 3. Fetch running totals for the realtime payload
    total_res = await client.database.from_("events").select("*", count="exact").execute()
    user_res = (
        await client.database
        .from_("events")
        .select("user_id", count="exact")
        .not_.is_("user_id", "null")
        .execute()
    )

    # 4. Broadcast via InsForge Realtime
    try:
        await client.realtime.connect()
        await client.realtime.subscribe(REALTIME_CHANNEL)
        await client.realtime.publish(
            REALTIME_CHANNEL,
            "new_event",
            {
                "event": event,
                "totals": {
                    "total_events": total_res.count or 0,
                    "unique_users": user_res.count or 0,
                },
            },
        )
    except Exception as exc:
        logger.warning("Realtime publish failed (non-fatal): %s", exc)

    return {"data": event}


@router.get("")
async def list_events(
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> dict:
    """Return recent events for the dashboard live-feed panel."""
    client = get_client()
    result = (
        await client.database
        .from_("events")
        .select("*")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return {"data": result.data or []}
