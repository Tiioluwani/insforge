# InsForge Analytics Dashboard

An AI-first, real-time analytics dashboard built end-to-end with [InsForge](https://github.com/InsForge/InsForge) — the open-source backend platform for agentic coding.

**Stack:** Python (FastAPI) · Next.js 14 · InsForge (Postgres · AI Model Gateway · Realtime)

---

## What this project demonstrates

| Capability | How InsForge powers it |
|---|---|
| Event ingestion | FastAPI writes to InsForge Postgres via `postgrest-py` |
| Live dashboard updates | `@insforge/sdk` Realtime (Socket.IO) — zero infra |
| AI trend analysis | InsForge AI Model Gateway (OpenAI/Anthropic/Gemini) — no API keys |
| Historical queries | InsForge Postgres + hourly rollup via `upsert_hourly_stat` RPC |
| Streaming AI output | FastAPI SSE → browser, persisted back to Postgres |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (Next.js)                        │
│                                                                  │
│   Dashboard.tsx                                                  │
│   ├── MetricCard ────────────────── REST  ─────────────────────┐ │
│   ├── EventsTimelineChart                                       │ │
│   ├── EventTypeChart          FastAPI (Python)                  │ │
│   ├── LiveEventFeed  ◄──────  ├─ POST /api/events              │ │
│   ├── AIInsightsPanel (SSE) ◄─├─ POST /api/insights (stream)   │ │
│   └── EventSimulator ────────►├─ POST /api/simulate            │ │
│                                └─ GET  /api/metrics             │ │
│   @insforge/sdk Realtime                                        │ │
│   └── Socket.IO subscribe ◄────────────────────────────────────┘ │
│       channel: analytics:events                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP + WebSocket
┌────────────────────────────▼────────────────────────────────────┐
│                     InsForge Backend                             │
│                                                                  │
│  ┌─────────────┐  ┌──────────────────────┐  ┌───────────────┐  │
│  │  PostgreSQL  │  │   AI Model Gateway   │  │   Realtime    │  │
│  │  PostgREST   │  │  OpenAI · Anthropic  │  │  Socket.IO    │  │
│  │             │  │  Gemini · Grok       │  │   channels    │  │
│  │  events     │  │                      │  │               │  │
│  │  hourly_stats│  │  /api/ai/chat/       │  │  analytics:   │  │
│  │  ai_insights│  │       completion     │  │  events       │  │
│  └─────────────┘  └──────────────────────┘  └───────────────┘  │
│                                                                  │
│  Self-hosted: docker compose  OR  https://insforge.dev          │
└─────────────────────────────────────────────────────────────────┘
```

### Data flow — real-time event

```
SDK / curl / EventSimulator
        │
        ▼
POST /api/events  (FastAPI)
        │
        ├─► INSERT events          (InsForge Postgres)
        ├─► upsert_hourly_stat()   (InsForge Postgres RPC)
        └─► realtime.publish()     (InsForge Realtime)
                    │
                    ▼
        Browser ← Socket.IO push
        └─ LiveEventFeed updates instantly
        └─ Dashboard re-fetches metrics
```

### Data flow — AI insight

```
"Generate Insight" button
        │
        ▼
POST /api/insights  (FastAPI)
        │
        ├─► SELECT events, hourly_stats  (InsForge Postgres)
        ├─► ai.stream(model, messages)   (InsForge AI Model Gateway)
        │       │
        │       └─► SSE chunks ──────────► Browser (text streams in)
        │
        └─► INSERT ai_insights           (InsForge Postgres)
                saved insight sent in final SSE frame
```

---

## Prerequisites

- **Python 3.11+** and **Node.js 18+**
- An [InsForge](https://github.com/InsForge/InsForge) project (cloud or self-hosted)

### Option A — InsForge Cloud

1. Sign up at [insforge.dev](https://insforge.dev)
2. Create a new project — you get a Postgres DB, AI gateway, and Realtime instantly
3. Copy your **Base URL** and **Anon Key** from the project dashboard

### Option B — Self-hosted

```bash
git clone https://github.com/InsForge/InsForge.git
cd InsForge
cp .env.example .env
docker compose -f docker-compose.prod.yml up -d
# Dashboard available at http://localhost:7130
```

> See the [InsForge MCP setup guide](https://github.com/InsForge/InsForge/blob/main/AGENTS.md)
> to connect Claude Code or Cursor to your instance.

---

## Quick start

### 1. Clone & configure

```bash
git clone https://github.com/your-org/insforge-analytics-dashboard.git
cd insforge-analytics-dashboard
```

**Frontend** (`.env.local`):

```bash
cp .env.example .env.local
# Edit .env.local:
# NEXT_PUBLIC_INSFORGE_BASE_URL=https://your-project.region.insforge.app
# NEXT_PUBLIC_INSFORGE_ANON_KEY=your-anon-key
# NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Backend** (`backend/.env`):

```bash
cp backend/.env.example backend/.env
# Edit backend/.env:
# INSFORGE_BASE_URL=https://your-project.region.insforge.app
# INSFORGE_SERVICE_KEY=your-service-key
```

### 2. Set up the database

Open your InsForge project → **SQL Editor** and run:

```bash
# paste contents of sql/schema.sql
```

This creates the `events`, `event_hourly_stats`, and `ai_insights` tables plus
the `upsert_hourly_stat` helper function and 500 seed rows for a live preview.

### 3. Start the FastAPI backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.
Interactive docs: `http://localhost:8000/docs`

### 4. Start the Next.js frontend

```bash
# from project root
npm install
npm run dev
# open http://localhost:3000
```

---

## Project structure

```
insforge-analytics-dashboard/
├── backend/                    # FastAPI backend
│   ├── main.py                 # App entry point, CORS, lifespan
│   ├── requirements.txt
│   ├── .env.example
│   ├── lib/
│   │   ├── insforge.py         # InsForge Python client (DB · AI · Realtime)
│   │   └── types.py            # Pydantic models
│   └── routers/
│       ├── events.py           # POST/GET  /api/events
│       ├── metrics.py          # GET       /api/metrics
│       ├── insights.py         # POST/GET  /api/insights  (SSE stream)
│       └── simulate.py         # POST      /api/simulate
│
├── src/                        # Next.js frontend
│   ├── app/
│   │   ├── layout.tsx
│   │   └── page.tsx            # Server component — pre-fetches insights
│   ├── components/
│   │   ├── Dashboard.tsx       # Main layout + realtime subscription
│   │   ├── MetricCard.tsx      # KPI cards
│   │   ├── EventsTimelineChart.tsx
│   │   ├── EventTypeChart.tsx
│   │   ├── LiveEventFeed.tsx   # Real-time event stream
│   │   ├── AIInsightsPanel.tsx # Streaming AI insight panel
│   │   ├── EventSimulator.tsx  # Demo event generator
│   │   └── ConnectionStatus.tsx
│   ├── lib/
│   │   ├── api.ts              # Fetch helpers → FastAPI
│   │   ├── insforge.ts         # @insforge/sdk browser client
│   │   └── realtime.ts         # Realtime subscription helpers
│   └── types/
│       └── index.ts
│
├── sql/
│   └── schema.sql              # Tables, indexes, seed data
│
└── .env.example
```

---

## API reference

### `POST /api/events`

Ingest one analytics event.

```bash
curl -X POST http://localhost:8000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "event_name": "page_view",
    "user_id": "user_42",
    "session_id": "sess_123",
    "page": "/pricing",
    "properties": { "country": "US", "browser": "Chrome" }
  }'
```

### `GET /api/metrics?range=24h`

Returns aggregated metrics. `range` accepts `1h`, `24h`, `7d`.

### `POST /api/insights`

Streams an AI-generated insight (SSE). Request body:

```json
{ "time_range": "24h" }
```

SSE frames:

```
data: {"chunk": "Traffic in the last 24 hours…"}
data: {"chunk": " peaked at 14:00 UTC…"}
data: {"done": true, "insight": { "id": "…", "title": "…", … }}
```

### `POST /api/simulate?count=10`

Generate `count` demo events (max 50).

---

## Built with an AI coding agent

This entire project was scaffolded using **Claude Code** (Anthropic's CLI coding agent) against an InsForge MCP server. The workflow:

```bash
# Install InsForge MCP for Claude Code
npx @insforge/install --client claude-code \
  --env API_KEY=<your-key> \
  --env API_BASE_URL=https://your-project.region.insforge.app
```

Then prompt Claude Code once:

> *"Build a real-time analytics dashboard. Use InsForge for the database, AI insights,
> and realtime. FastAPI backend, Next.js frontend."*

InsForge's MCP server exposes your schema, available models, and realtime channels
directly to the agent — it has full context to scaffold, configure, and deploy without
manual wiring. Any AI coding agent is compatible:
[Cursor](https://cursor.sh), [Windsurf](https://windsurf.ai), [Cline](https://github.com/cline/cline),
[Roo Code](https://roocode.com), or your own agent via the
[Model Context Protocol](https://modelcontextprotocol.io).

---

## InsForge highlights

| Feature | What it replaces |
|---|---|
| Postgres + PostgREST | Supabase DB + manual migrations |
| AI Model Gateway | OpenAI/Anthropic API keys + per-provider SDKs |
| Realtime (Socket.IO) | Pusher, Ably, or self-managed WebSocket server |
| MCP server for agents | Manual backend scaffolding per project |
| One `docker compose up` | Separate Postgres + Redis + WS + auth services |

**InsForge does end-to-end** — database, auth, storage, functions, AI, and realtime
in one self-hostable platform. Supabase and Firebase each cover parts of this story;
InsForge closes the gaps specifically for AI-assisted development workflows.

---

## License

MIT — see [LICENSE](LICENSE).

## Links

- [InsForge GitHub](https://github.com/InsForge/InsForge)
- [InsForge Docs](https://docs.insforge.dev)
- [MCP specification](https://modelcontextprotocol.io)
- [`@insforge/sdk` on npm](https://www.npmjs.com/package/@insforge/sdk)
- [`@insforge/mcp` on npm](https://www.npmjs.com/package/@insforge/mcp)
