import { InsForgeClient } from '@insforge/sdk';

// ─── Browser client (uses anon key, safe to expose) ───────────────────────────
// Used in React components for auth-aware operations.
let _browserClient: InsForgeClient | null = null;

export function getClient(): InsForgeClient {
  if (_browserClient) return _browserClient;

  _browserClient = new InsForgeClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL ?? 'http://localhost:7130',
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ?? '',
  });

  return _browserClient;
}

// ─── Server client (uses service key, never exposed to browser) ───────────────
// Used in Next.js API routes and Server Components.
let _serverClient: InsForgeClient | null = null;

export function getServerClient(): InsForgeClient {
  if (_serverClient) return _serverClient;

  _serverClient = new InsForgeClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL ?? 'http://localhost:7130',
    anonKey: process.env.INSFORGE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ?? '',
    // Disable token persistence on the server
    persistSession: false,
  });

  return _serverClient;
}
