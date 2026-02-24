"""
Simulate router
POST /api/simulate?count=10  — generate demo analytics events
"""

from __future__ import annotations

import asyncio
import logging
import random
import string
from typing import Annotated

from fastapi import APIRouter, Query

from lib.insforge import get_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/simulate", tags=["simulate"])

_EVENT_NAMES = ["page_view", "click", "search", "signup", "purchase", "feature_used", "error", "session_start", "logout", "invite_sent"]
_PAGES = ["/", "/pricing", "/docs", "/blog", "/signup", "/dashboard", "/settings", "/integrations"]
_COUNTRIES = ["US", "UK", "DE", "FR", "JP", "CA", "AU", "BR", "IN", "MX"]
_BROWSERS = ["Chrome", "Firefox", "Safari", "Edge"]
_SEARCH_TERMS = ["dashboard", "pricing", "api docs", "integrations", "analytics", "realtime"]
_REFERRERS = ["https://google.com", "https://twitter.com", "https://hackernews.com", None, None, None]


def _random_event() -> dict:
    event_name = random.choice(_EVENT_NAMES)
    props: dict = {
        "country": random.choice(_COUNTRIES),
        "browser": random.choice(_BROWSERS),
    }

    if event_name == "purchase":
        props["amount"] = round(random.uniform(9.99, 299.99), 2)
        props["currency"] = "USD"
        props["plan"] = random.choice(["starter", "pro", "enterprise"])

    if event_name == "search":
        props["query"] = random.choice(_SEARCH_TERMS)

    if event_name == "feature_used":
        props["feature"] = random.choice(["export", "share", "embed", "filter", "compare"])

    return {
        "event_name": event_name,
        "user_id": f"user_{random.randint(1, 300)}",
        "session_id": f"sess_{random.randint(1, 600)}",
        "page": random.choice(_PAGES) if event_name == "page_view" else None,
        "referrer": random.choice(_REFERRERS),
        "properties": props,
    }


@router.post("")
async def simulate_events(
    count: Annotated[int, Query(ge=1, le=50)] = 10,
) -> dict:
    """
    Generate `count` realistic analytics events, insert them into InsForge
    Postgres, update hourly buckets, and broadcast a batch signal via Realtime.
    """
    client = get_client()
    events = [_random_event() for _ in range(count)]

    # Batch insert
    result = await client.database.from_("events").insert(events).execute()
    inserted = result.data or []

    # Update hourly buckets for each unique event name
    unique_names = {e["event_name"] for e in events}
    await asyncio.gather(
        *[
            client.database.rpc("upsert_hourly_stat", {"p_event_name": name, "p_ts": "NOW()"})
            for name in unique_names
        ],
        return_exceptions=True,
    )

    # Broadcast batch-ingested signal
    try:
        await client.realtime.connect()
        await client.realtime.subscribe("analytics:events")
        await client.realtime.publish(
            "analytics:events",
            "batch_ingested",
            {"count": len(inserted), "sample": inserted[0] if inserted else None},
        )
    except Exception as exc:
        logger.warning("Realtime publish failed (non-fatal): %s", exc)

    return {"data": {"count": len(inserted)}}
