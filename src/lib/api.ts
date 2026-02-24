/**
 * API client — calls the FastAPI backend.
 * The backend URL is set via NEXT_PUBLIC_API_URL (default: http://localhost:8000).
 */

import type {
  AnalyticsEvent,
  AiInsight,
  IngestEventRequest,
  InsightRequest,
  InsightStreamChunk,
  MetricsResponse,
  TimeRange,
} from '@/types';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? body?.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function ingestEvent(payload: IngestEventRequest) {
  return apiFetch<{ data: AnalyticsEvent }>('/api/events', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listEvents(limit = 50): Promise<AnalyticsEvent[]> {
  const { data } = await apiFetch<{ data: AnalyticsEvent[] }>(
    `/api/events?limit=${limit}`,
  );
  return data;
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

export async function fetchMetrics(range: TimeRange = '24h'): Promise<MetricsResponse> {
  const { data } = await apiFetch<{ data: MetricsResponse }>(
    `/api/metrics?range=${range}`,
  );
  return data;
}

// ─── AI Insights ──────────────────────────────────────────────────────────────

/**
 * Streams an AI insight from the backend (Server-Sent Events).
 * Calls `onChunk` for each text delta and `onDone` with the saved insight.
 */
export async function streamInsight(
  request: InsightRequest,
  callbacks: {
    onChunk: (text: string) => void;
    onDone: (insight: AiInsight) => void;
    onError: (msg: string) => void;
  },
): Promise<void> {
  const res = await fetch(`${BASE}/api/insights`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!res.ok || !res.body) {
    callbacks.onError(`Request failed: HTTP ${res.status}`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;
      try {
        const parsed: InsightStreamChunk = JSON.parse(raw);
        if (parsed.error) {
          callbacks.onError(parsed.error);
          return;
        }
        if (parsed.chunk) callbacks.onChunk(parsed.chunk);
        if (parsed.done && parsed.insight) callbacks.onDone(parsed.insight as AiInsight);
      } catch {
        // ignore malformed lines
      }
    }
  }
}

export async function listInsights(limit = 5): Promise<AiInsight[]> {
  const { data } = await apiFetch<{ data: AiInsight[] }>(
    `/api/insights?limit=${limit}`,
  );
  return data;
}

// ─── Simulator ────────────────────────────────────────────────────────────────

export async function simulateEvents(count = 10): Promise<{ count: number }> {
  const { data } = await apiFetch<{ data: { count: number } }>(
    `/api/simulate?count=${count}`,
    { method: 'POST' },
  );
  return data;
}
