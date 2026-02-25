/**
 * InsForge Realtime — browser-side subscription helper.
 *
 * Uses @insforge/sdk directly in the browser (Socket.IO under the hood).
 * The client subscribes to the `analytics:events` channel and fires
 * callbacks whenever the FastAPI backend publishes a new event or a
 * batch-ingested signal.
 */

'use client';

import { getClient } from './insforge';
import type { ConnectionStatus, RealtimeEventPayload } from '@/types';

const CHANNEL = 'analytics:events';

export interface RealtimeCallbacks {
  onNewEvent: (payload: RealtimeEventPayload) => void;
  onBatchIngested: (payload: { count: number }) => void;
  onStatusChange: (status: ConnectionStatus) => void;
}

let subscribed = false;

export async function subscribeToAnalytics(callbacks: RealtimeCallbacks): Promise<() => void> {
  const client = getClient();
  const rt = client.realtime;

  callbacks.onStatusChange('connecting');

  // Connection lifecycle
  rt.on('connect', () => callbacks.onStatusChange('connected'));
  rt.on('connect_error', () => callbacks.onStatusChange('polling'));
  rt.on('disconnect', () => callbacks.onStatusChange('disconnected'));

  // Domain events (SocketMessage wraps the payload in `payload` field)
  rt.on('new_event', (msg: any) => {
    const data = msg?.payload ?? msg;
    callbacks.onNewEvent(data as RealtimeEventPayload);
  });

  rt.on('batch_ingested', (msg: any) => {
    const data = msg?.payload ?? msg;
    callbacks.onBatchIngested(data);
  });

  if (!subscribed) {
    await rt.connect();
    await rt.subscribe(CHANNEL);
    subscribed = true;
  }

  // Return cleanup function
  return () => {
    subscribed = false;
    rt.unsubscribe(CHANNEL);
    rt.disconnect();
    callbacks.onStatusChange('disconnected');
  };
}
