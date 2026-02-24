'use client';

import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  delta?: number;       // percentage change (positive = up, negative = down)
  color?: 'indigo' | 'emerald' | 'violet' | 'amber';
  loading?: boolean;
}

const COLOR_MAP = {
  indigo:  { bg: 'bg-indigo-500/10',  icon: 'text-indigo-400',  ring: 'ring-indigo-500/20' },
  emerald: { bg: 'bg-emerald-500/10', icon: 'text-emerald-400', ring: 'ring-emerald-500/20' },
  violet:  { bg: 'bg-violet-500/10',  icon: 'text-violet-400',  ring: 'ring-violet-500/20' },
  amber:   { bg: 'bg-amber-500/10',   icon: 'text-amber-400',   ring: 'ring-amber-500/20' },
};

export default function MetricCard({
  label,
  value,
  icon: Icon,
  delta,
  color = 'indigo',
  loading = false,
}: MetricCardProps) {
  const c = COLOR_MAP[color];

  return (
    <div className={clsx(
      'rounded-xl border border-white/5 bg-white/[0.03] p-5 ring-1',
      c.ring,
    )}>
      <div className="flex items-start justify-between">
        <span className="text-sm text-gray-400">{label}</span>
        <span className={clsx('rounded-lg p-2', c.bg)}>
          <Icon size={16} className={c.icon} />
        </span>
      </div>

      {loading ? (
        <div className="mt-3 h-8 w-24 animate-pulse rounded-md bg-white/5" />
      ) : (
        <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      )}

      {delta !== undefined && (
        <p className={clsx(
          'mt-1 text-xs font-medium',
          delta >= 0 ? 'text-emerald-400' : 'text-red-400',
        )}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
          <span className="ml-1 text-gray-500">vs previous period</span>
        </p>
      )}
    </div>
  );
}
