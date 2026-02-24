'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, parseISO } from 'date-fns';
interface Props {
  data: { bucket_start: string; count: number }[];
  loading?: boolean;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-gray-900/95 px-3 py-2 text-sm shadow-xl">
      <p className="text-gray-400">{label}</p>
      <p className="mt-0.5 font-semibold text-indigo-300">
        {payload[0].value.toLocaleString()} events
      </p>
    </div>
  );
}

export default function EventsTimelineChart({ data, loading }: Props) {
  const formatted = data.map((d) => ({
    ...d,
    label: format(parseISO(d.bucket_start), 'MMM d HH:mm'),
  }));

  if (loading) {
    return (
      <div className="h-56 w-full animate-pulse rounded-xl bg-white/5" />
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formatted} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#6b7280', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#grad)"
            dot={false}
            activeDot={{ r: 4, fill: '#818cf8' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
