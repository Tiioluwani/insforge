'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#4f46e5', '#7c3aed', '#4338ca'];

interface Props {
  data: { event_name: string; count: number }[];
  loading?: boolean;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-gray-900/95 px-3 py-2 text-sm shadow-xl">
      <p className="font-medium text-white">{payload[0].payload.event_name}</p>
      <p className="mt-0.5 text-indigo-300">{payload[0].value.toLocaleString()} events</p>
    </div>
  );
}

export default function EventTypeChart({ data, loading }: Props) {
  if (loading) {
    return <div className="h-48 w-full animate-pulse rounded-xl bg-white/5" />;
  }

  const top = data.slice(0, 8);

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={top} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" vertical={false} />
          <XAxis
            dataKey="event_name"
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff08' }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {top.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
