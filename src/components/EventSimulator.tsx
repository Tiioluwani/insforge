'use client';

import { useState } from 'react';
import { Zap } from 'lucide-react';
import clsx from 'clsx';
import { simulateEvents } from '@/lib/api';

const COUNTS = [5, 10, 25, 50];

export default function EventSimulator({ onSimulated }: { onSimulated: () => void }) {
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(10);
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function handleSimulate() {
    setLoading(true);
    setLastResult(null);
    try {
      const result = await simulateEvents(count);
      setLastResult(`+${result.count} events ingested`);
      onSimulated(); // trigger metrics refresh in parent
    } catch (err) {
      setLastResult('Simulation failed — check backend connection');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
        {COUNTS.map((n) => (
          <button
            key={n}
            onClick={() => setCount(n)}
            className={clsx(
              'rounded-md px-3 py-1 text-xs font-medium transition-colors',
              count === n
                ? 'bg-white/10 text-white'
                : 'text-gray-500 hover:text-gray-300',
            )}
          >
            {n}
          </button>
        ))}
      </div>

      <button
        onClick={handleSimulate}
        disabled={loading}
        className={clsx(
          'flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-all',
          loading
            ? 'cursor-not-allowed bg-amber-700/30 text-amber-400'
            : 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25 hover:bg-amber-500/25',
        )}
      >
        <Zap size={14} className={loading ? 'animate-spin' : ''} />
        {loading ? 'Simulating…' : `Simulate ${count} events`}
      </button>

      {lastResult && (
        <span className="text-xs text-emerald-400 animate-fade-in">{lastResult}</span>
      )}
    </div>
  );
}
