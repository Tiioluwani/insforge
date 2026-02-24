from __future__ import annotations
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field
from datetime import datetime


# ─── Domain models ────────────────────────────────────────────────────────────

class AnalyticsEvent(BaseModel):
    id: str
    event_name: str
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    page: Optional[str] = None
    referrer: Optional[str] = None
    properties: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class HourlyStat(BaseModel):
    id: str
    event_name: str
    bucket_start: datetime
    count: int


class AiInsight(BaseModel):
    id: str
    insight_type: Literal["trend", "anomaly", "summary"] = "trend"
    title: str
    content: str
    time_range: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


# ─── API request / response models ────────────────────────────────────────────

TimeRange = Literal["1h", "24h", "7d"]


class IngestEventRequest(BaseModel):
    event_name: str
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    page: Optional[str] = None
    referrer: Optional[str] = None
    properties: dict[str, Any] = Field(default_factory=dict)


class EventNameCount(BaseModel):
    event_name: str
    count: int


class PageCount(BaseModel):
    page: str
    count: int


class TimeSeriesPoint(BaseModel):
    bucket_start: str
    count: int


class MetricsResponse(BaseModel):
    total_events: int
    unique_users: int
    unique_sessions: int
    events_by_name: list[EventNameCount]
    time_series: list[TimeSeriesPoint]
    top_pages: list[PageCount]


class InsightRequest(BaseModel):
    time_range: TimeRange = "24h"


class RealtimeEventPayload(BaseModel):
    event: dict[str, Any]
    totals: dict[str, int]
