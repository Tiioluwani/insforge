'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Users, MousePointerClick, TrendingUp } from 'lucide-react';
import { subscribeToAnalytics } from '@/lib/realtime';
import { fetchMetrics, listEvents, listInsights } from '@/lib/api';
import MetricCard from './MetricCard';
import EventsTimelineChart from './EventsTimelineChart';
import EventTypeChart from './EventTypeChart';
import LiveEventFeed from './LiveEventFeed';
import AIInsightsPanel from './AIInsightsPanel';
import EventSimulator from './EventSimulator';
import ConnectionStatus from './ConnectionStatus';
import type {
  AiInsight,
  AnalyticsEvent,
  ConnectionStatus as CS,
  MetricsResponse,
  TimeRange,
} from '@/types';

const RANGE_OPTIONS: { label: string; value: TimeRange }[] = [
  { label: '1h', value: '1h' },
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
];

const POLL_INTERVAL_MS = 30_000; // fallback poll every 30s if realtime is down

interface DashboardProps {
  initialInsights: AiInsight[];
}

export default function Dashboard({ initialInsights }: DashboardProps) {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [range, setRange] = useState<TimeRange>('24h');
  const [connStatus, setConnStatus] = useState<CS>('disconnected');
  const [metricsLoading, setMetricsLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadMetrics = useCallback(async () => {
    try {
      const data = await fetchMetrics(range);
      setMetrics(data);
    } catch (err) {
      console.error('metrics fetch error', err);
    } finally {
      setMetricsLoading(false);
    }
  }, [range]);

  const loadEvents = useCallback(async () => {
    try {
      const data = await listEvents(50);
      setEvents(data);
    } catch (err) {
      console.error('events fetch error', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    setMetricsLoading(true);
    loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Realtime subscription via InsForge
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    subscribeToAnalytics({
      onStatusChange: setConnStatus,
      onNewEvent: (payload) => {
        // Prepend new event to the live feed
        setEvents((prev) => [payload.event as AnalyticsEvent, ...prev].slice(0, 100));
        // Debounce metrics refresh — realtime gives us the signal, we pull updated counts
        loadMetrics();
      },
      onBatchIngested: () => {
        // Batch simulation: reload everything
        loadMetrics();
        loadEvents();
      },
    }).then((unsub) => {
      unsubscribe = unsub;
    });

    // Fallback polling in case realtime is unavailable
    pollRef.current = setInterval(loadMetrics, POLL_INTERVAL_MS);

    return () => {
      unsubscribe?.();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* ── Header ── */}
      <header className="border-b border-white/5 bg-white/[0.02] px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              Analytics Dashboard
            </h1>
            <p className="text-xs text-gray-500">
              Powered by{' '}
              <a
                href="https://github.com/InsForge/InsForge"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:underline"
              >
                InsForge
              </a>
              {' '}· Realtime · AI · Postgres
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Range selector */}
            <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRange(opt.value)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    range === opt.value
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <ConnectionStatus status={connStatus} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">

        {/* ── KPI row ── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total Events"
            value={metrics?.total_events ?? 0}
            icon={Activity}
            color="indigo"
            loading={metricsLoading}
          />
          <MetricCard
            label="Unique Users"
            value={metrics?.unique_users ?? 0}
            icon={Users}
            color="emerald"
            loading={metricsLoading}
          />
          <MetricCard
            label="Unique Sessions"
            value={metrics?.unique_sessions ?? 0}
            icon={MousePointerClick}
            color="violet"
            loading={metricsLoading}
          />
          <MetricCard
            label="Event Types"
            value={metrics?.events_by_name.length ?? 0}
            icon={TrendingUp}
            color="amber"
            loading={metricsLoading}
          />
        </div>

        {/* ── Charts row ── */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-xl border border-white/5 bg-white/[0.02] p-5">
            <h2 className="mb-4 text-sm font-medium text-gray-300">
              Event Volume over Time
            </h2>
            <EventsTimelineChart
              data={metrics?.time_series ?? []}
              loading={metricsLoading}
            />
          </div>

          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
            <h2 className="mb-4 text-sm font-medium text-gray-300">
              Event Breakdown
            </h2>
            <EventTypeChart
              data={metrics?.events_by_name ?? []}
              loading={metricsLoading}
            />
          </div>
        </div>

        {/* ── Live feed + AI ── */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Live Event Feed */}
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-300">Live Event Feed</h2>
              <ConnectionStatus status={connStatus} />
            </div>
            <LiveEventFeed events={events} />
          </div>

          {/* AI Insights */}
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
            <h2 className="mb-4 text-sm font-medium text-gray-300">AI Insights</h2>
            <AIInsightsPanel initialInsights={initialInsights} />
          </div>
        </div>

        {/* ── Top Pages table ── */}
        {(metrics?.top_pages.length ?? 0) > 0 && (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
            <h2 className="mb-4 text-sm font-medium text-gray-300">Top Pages</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left text-xs text-gray-500">
                    <th className="pb-2 font-medium">Page</th>
                    <th className="pb-2 font-medium text-right">Events</th>
                    <th className="pb-2 font-medium text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {metrics!.top_pages.map((row) => {
                    const share = metrics!.total_events
                      ? ((row.count / metrics!.total_events) * 100).toFixed(1)
                      : '0';
                    return (
                      <tr key={row.page} className="text-gray-400 hover:text-gray-200">
                        <td className="py-2 font-mono text-xs text-indigo-300">{row.page}</td>
                        <td className="py-2 text-right">{row.count.toLocaleString()}</td>
                        <td className="py-2 text-right text-gray-500">{share}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Event Simulator ── */}
        <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.03] p-5">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-medium text-gray-300">Event Simulator</h2>
            <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400">
              Demo only
            </span>
          </div>
          <p className="mb-4 text-xs text-gray-500">
            Generate realistic analytics events to see the live feed, charts, and AI
            insights update in real time — all powered by InsForge.
          </p>
          <EventSimulator onSimulated={loadMetrics} />
        </div>

      </main>
    </div>
  );
}
