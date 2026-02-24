// ─── Domain types ─────────────────────────────────────────────────────────────

export interface AnalyticsEvent {
  id: string;
  event_name: string;
  user_id: string | null;
  session_id: string | null;
  page: string | null;
  referrer: string | null;
  properties: Record<string, unknown>;
  created_at: string;
}

export interface HourlyStat {
  id: string;
  event_name: string;
  bucket_start: string;
  count: number;
}

export interface AiInsight {
  id: string;
  insight_type: 'trend' | 'anomaly' | 'summary';
  title: string;
  content: string;
  time_range: TimeRange;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─── API request / response types ─────────────────────────────────────────────

export interface IngestEventRequest {
  event_name: string;
  user_id?: string;
  session_id?: string;
  page?: string;
  referrer?: string;
  properties?: Record<string, unknown>;
}

export type TimeRange = '1h' | '24h' | '7d';

export interface MetricsResponse {
  total_events: number;
  unique_users: number;
  unique_sessions: number;
  events_by_name: { event_name: string; count: number }[];
  time_series: { bucket_start: string; count: number }[];
  top_pages: { page: string; count: number }[];
}

export interface InsightRequest {
  time_range: TimeRange;
}

export interface InsightStreamChunk {
  chunk?: string;
  done?: boolean;
  insight?: AiInsight;
  error?: string;
}

// ─── Realtime event payloads ───────────────────────────────────────────────────

export interface RealtimeEventPayload {
  event: AnalyticsEvent;
  totals: {
    total_events: number;
    unique_users: number;
  };
}

// ─── UI state ─────────────────────────────────────────────────────────────────

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
