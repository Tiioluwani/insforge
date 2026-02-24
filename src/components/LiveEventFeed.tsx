'use client';

import { useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import type { AnalyticsEvent } from '@/types';

const EVENT_COLORS: Record<string, string> = {
  page_view:    'bg-blue-500/20 text-blue-300',
  click:        'bg-violet-500/20 text-violet-300',
  signup:       'bg-emerald-500/20 text-emerald-300',
  purchase:     'bg-amber-500/20 text-amber-300',
  search:       'bg-sky-500/20 text-sky-300',
  feature_used: 'bg-purple-500/20 text-purple-300',
  error:        'bg-red-500/20 text-red-300',
  session_start:'bg-teal-500/20 text-teal-300',
  logout:       'bg-gray-500/20 text-gray-300',
  invite_sent:  'bg-pink-500/20 text-pink-300',
};

function eventColor(name: string) {
  return EVENT_COLORS[name] ?? 'bg-indigo-500/20 text-indigo-300';
}

interface Props {
  events: AnalyticsEvent[];
}

export default function LiveEventFeed({ events }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest event
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-500">
        Waiting for events…
      </div>
    );
  }

  return (
    <div className="h-64 overflow-y-auto pr-1">
      <ul className="space-y-1.5">
        {events.map((event) => (
          <li
            key={event.id}
            className="flex items-start gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-white/[0.03] animate-fade-in"
          >
            <span
              className={clsx(
                'mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium',
                eventColor(event.event_name),
              )}
            >
              {event.event_name}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-gray-300">
                {event.user_id ?? 'anonymous'}
                {event.page ? (
                  <span className="ml-1.5 text-gray-500">{event.page}</span>
                ) : null}
              </p>
              {event.properties?.country ? (
                <p className="mt-0.5 text-xs text-gray-600">
                  {String(event.properties.country)}
                  {event.properties.amount
                    ? ` · $${String(event.properties.amount)}`
                    : ''}
                </p>
              ) : null}
            </div>
            <time className="shrink-0 text-xs text-gray-600">
              {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
            </time>
          </li>
        ))}
      </ul>
      <div ref={bottomRef} />
    </div>
  );
}
