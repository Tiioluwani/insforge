'use client';

import { useState } from 'react';
import { Sparkles, Clock, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { streamInsight } from '@/lib/api';
import type { AiInsight, TimeRange } from '@/types';

interface Props {
  initialInsights: AiInsight[];
}

const RANGE_OPTIONS: { label: string; value: TimeRange }[] = [
  { label: '1 hour', value: '1h' },
  { label: '24 hours', value: '24h' },
  { label: '7 days', value: '7d' },
];

export default function AIInsightsPanel({ initialInsights }: Props) {
  const [insights, setInsights] = useState<AiInsight[]>(initialInsights);
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');
  const [range, setRange] = useState<TimeRange>('24h');
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setStreaming(true);
    setStreamBuffer('');
    setError(null);

    await streamInsight(
      { time_range: range },
      {
        onChunk: (text) => setStreamBuffer((prev) => prev + text),
        onDone: (insight) => {
          setInsights((prev) => [insight, ...prev.slice(0, 4)]);
          setStreamBuffer('');
          setStreaming(false);
        },
        onError: (msg) => {
          setError(msg);
          setStreaming(false);
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={clsx(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                range === opt.value
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-gray-200',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleGenerate}
          disabled={streaming}
          className={clsx(
            'flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-all',
            streaming
              ? 'cursor-not-allowed bg-indigo-700/40 text-indigo-300'
              : 'bg-indigo-600 text-white hover:bg-indigo-500',
          )}
        >
          {streaming ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          {streaming ? 'Generating…' : 'Generate Insight'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Streaming buffer */}
      {streaming && streamBuffer && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-indigo-400">
            <Sparkles size={12} />
            Analyzing with Claude via InsForge…
          </div>
          <p className="text-sm leading-relaxed text-gray-300 whitespace-pre-wrap">
            {streamBuffer}
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-indigo-400" />
          </p>
        </div>
      )}

      {/* Saved insights */}
      <div className="space-y-3">
        {insights.length === 0 && !streaming && (
          <p className="text-center text-sm text-gray-500 py-8">
            No insights yet — click "Generate Insight" to analyze your data.
          </p>
        )}
        {insights.map((insight) => (
          <div
            key={insight.id}
            className="rounded-xl border border-white/5 bg-white/[0.03] p-4 animate-slide-in"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">{insight.title}</h3>
              <div className="flex shrink-0 items-center gap-1 text-xs text-gray-500">
                <Clock size={11} />
                {formatDistanceToNow(new Date(insight.created_at), { addSuffix: true })}
              </div>
            </div>
            <span className="mt-1 inline-block rounded-md bg-indigo-500/15 px-2 py-0.5 text-xs text-indigo-300">
              {insight.time_range} window
            </span>
            <p className="mt-2 text-sm leading-relaxed text-gray-400 whitespace-pre-wrap">
              {insight.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
