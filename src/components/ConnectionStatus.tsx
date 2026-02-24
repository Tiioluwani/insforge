'use client';

import clsx from 'clsx';
import type { ConnectionStatus as CS } from '@/types';

const CONFIG: Record<CS, { label: string; dot: string; text: string }> = {
  connected:    { label: 'Live',         dot: 'bg-green-400 animate-pulse-dot', text: 'text-green-400' },
  connecting:   { label: 'Connecting…',  dot: 'bg-yellow-400 animate-pulse-dot', text: 'text-yellow-400' },
  disconnected: { label: 'Disconnected', dot: 'bg-gray-500',                     text: 'text-gray-400' },
  error:        { label: 'Error',        dot: 'bg-red-500',                      text: 'text-red-400' },
};

export default function ConnectionStatus({ status }: { status: CS }) {
  const cfg = CONFIG[status];
  return (
    <span className={clsx('flex items-center gap-1.5 text-xs font-medium', cfg.text)}>
      <span className={clsx('inline-block h-2 w-2 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  );
}
