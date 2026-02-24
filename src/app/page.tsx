/**
 * Root page — server component.
 * Pre-fetches the most recent AI insights on the server so the AI panel
 * renders with content on first load, then streams updates client-side.
 */

import Dashboard from '@/components/Dashboard';
import type { AiInsight } from '@/types';

async function getInitialInsights(): Promise<AiInsight[]> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
    const res = await fetch(`${apiUrl}/api/insights?limit=3`, {
      next: { revalidate: 60 }, // ISR: revalidate every 60s
    });
    if (!res.ok) return [];
    const { data } = await res.json();
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function Home() {
  const insights = await getInitialInsights();
  return <Dashboard initialInsights={insights} />;
}
