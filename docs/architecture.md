# Architecture

## Overview

LifeOS is a single-user Next.js progressive web application that normalizes calendar and task data from multiple sources into a unified planning system.

**Release status:** RC1 focuses on product chrome and UX polish (settings IA, header/account menu, search/command palette, Today dashboard, readiness diagnostics) without changing database architecture, RLS, or major subsystems.

## Component diagram

```text
Browser (PWA)
    │
    ▼
Next.js App Router
    ├── Middleware (auth + email allowlist)
    ├── Server Components (dashboard pages)
    ├── Client Components (login, navigation)
    └── Route Handlers (API)
            │
            ▼
    Supabase Auth (sessions)
            │
            ▼
    Supabase PostgreSQL (Phase 2+)
```

## Data flow (target state)

```text
External Sources          Connectors           Normalization
─────────────────         ──────────           ─────────────
Microsoft Graph    ──►   microsoft/*     ──►  events, tasks
Canvas ICS feed    ──►   canvas/*        ──►  events + linked tasks (deadlines)
Workforce form     ──►   workforce/*     ──►  work shifts
Manual entry       ──►   app services    ──►  events, tasks
                              │
                              ▼
                       PostgreSQL (RLS)
                              │
                              ▼
                       Planning Engine
                              │
                              ▼
                       Dashboard / Chat / Notifications
```

## Trust boundaries

| Boundary | What crosses it | Protection |
|----------|-----------------|------------|
| Browser ↔ Next.js | HTML, public env vars, session cookies | HTTPS, httpOnly cookies |
| Next.js ↔ Supabase Auth | JWT/session via SSR client | Server-side session refresh |
| Next.js ↔ Supabase DB | Queries scoped by `user_id` | RLS + server auth checks |
| Next.js ↔ External APIs | OAuth tokens, ICS URLs | Server-only, encrypted storage (Phase 3+) |

## Phase 8 scope

Phase 8 adds read-only Microsoft 365 calendar integration:

- Feature flag `MICROSOFT_INTEGRATION_ENABLED` (default `false`) gates UI, OAuth, sync, and env validation

- OAuth 2.0 authorization code + PKCE via `@azure/msal-node`
- Encrypted MSAL token cache (not individual refresh tokens in plaintext columns)
- Calendar discovery and per-calendar sync/visibility selection
- Graph `calendarView/delta` incremental sync into `events` (`source=microsoft`, `is_read_only=true`)
- Manual and hourly cron synchronization with atomic connection claims
- Microsoft events flow into Today, Week, workload, proposals, chat agenda, and notifications without engine changes

## Phase 1 scope

Phase 1 establishes:

- Authentication via Supabase
- Email allowlist enforcement in middleware and server helpers
- Protected dashboard shell with navigation
- PWA installability (manifest, icons, basic service worker)
- Environment validation with Zod

No database tables, external integrations, or planning logic exist yet.

## Phase 4 scope

Phase 4 adds a deterministic planning engine:

- Pure workload calculations in `src/lib/planning/`
- Daily and weekly capacity analysis (America/Chicago)
- Analytical task allocation (recommendations only — no calendar writes)
- `workload_snapshots` cache table
- `events.blocks_time` for all-day blocking behavior
- Canvas deadline → task estimate workflow (Phase 4; auto task creation in Phase 6.5)
- Today / Week workload UI with improved desktop layouts

## Phase 5 scope

Phase 5 adds Web Push delivery:

- `push_subscriptions` and `notification_deliveries` tables
- VAPID-based sender (`web-push`) in `src/lib/notifications/`
- Service worker push/click handlers in `public/sw.js`
- Settings → Notifications UI with device management
- Protected cron endpoint `POST /api/cron/notifications`
- Daily/weekly/deadline/overload notification scheduling in America/Chicago
- Privacy modes for lock-screen-safe payloads

## Phase 6 scope

Phase 6 adds deterministic planning proposals:

- Open-interval calculation and focus-block placement in `src/lib/planning/`
- `planning_runs` / `planning_proposals` persistence
- Confirmation-based writes to **LifeOS Planning** calendar only
- Stale-proposal revalidation before accept
- Today / Week proposal UI; Tasks focus-schedule summary

```text
Planning inputs (events, tasks, availability, preferences)
        │
        ▼
generatePlanningProposals()  ──► planning_runs + planning_proposals
        │
        ▼ (user accepts)
accept_planning_proposal RPC ──► events (focus_block, related_task_id)
```

## Phase 7 scope

Phase 7 adds a deterministic planning chat assistant at `/chat` (no LLM):

```text
User message
    │
    ▼
parseCommand() + Zod validation
    │
    ├── read-only intents ──► executeReadOnly() ──► agenda / workload / availability / plan
    │
    └── write intents ──► assistant_actions (proposed) ──► user confirms ──► executeConfirmedAction()
```

- Parser: `src/lib/assistant/` (pattern rules, date/duration parsing, entity matching)
- Persistence: `assistant_threads`, `assistant_messages`, `assistant_actions`
- Reuses workload engine, open intervals, planning run generation, and proposal accept/reject RPCs
- Manual calendar for assistant-created events; LifeOS Planning calendar only via proposal acceptance
- Clarification state for missing duration, dates, or ambiguous task matches
- Idempotent confirmed actions with 30-minute expiration

A future external AI provider would map natural language to the same intent union — no parallel business logic.

## Phase 6.6 scope

Phase 6.6 adds scheduled Canvas synchronization and reclassification cleanup:

```text
Manual Sync Now ──┐
                  ├──► syncCanvasForUser({ ctx, connectionId, trigger })
Supabase Cron ────┘         │
                            ├── claim_connection_for_sync (atomic)
                            ├── fetch / parse / normalize
                            ├── upsertCanvasEvent (all entries)
                            ├── removal reconciliation (trustworthy feeds)
                            ├── reconcileReclassifiedCanvasTasks
                            └── syncCanvasTasksForDeadlineEvents
```

- Shared service: `syncCanvasForUser()` in `src/lib/integrations/canvas/sync.ts`
- Context-scoped DB access: `src/lib/integrations/canvas/sync-data.ts`
- Cron route: `POST /api/cron/canvas-sync` (no push on success)
- Import Center shows manual/automatic last-sync trigger

## Phase 6.5 scope

Phase 6.5 extends Canvas synchronization to automatically create and upsert linked tasks for classified deadline events:

```text
Canvas ICS sync
    ├── upsertCanvasEvent (all entries)
    ├── removal reconciliation (events, conservative)
    └── syncCanvasTasksForDeadlineEvents (deadline entries only)
            │
            ▼
    One read-only deadline event + one linked canvas task per assignment
```

- Task sync in `src/lib/integrations/canvas/task-sync.ts`
- Batch repository helpers in `src/lib/data/tasks.ts` and `src/lib/data/events.ts`
- Nested sync result: `{ events, tasks, warnings }`
- Estimate workflow updates existing tasks (no duplicate creation path)
- Workload and proposal engines consume auto-synced tasks without new planning logic

## Layer separation

1. **Connectors** — Fetch provider-specific data
2. **Normalization** — Map to internal event/task types
3. **Persistence** — Store in PostgreSQL with sync state
4. **Planning** — Availability, workload, scheduling (`src/lib/planning/`)
5. **Interaction** — Dashboards, calendar, chat
6. **Delivery** — Push notifications (Phase 5), email summaries (deferred)

## Key design decisions

- **Single TypeScript app** — No separate backend for initial phases
- **External calendars as source of truth** — Sync into normalized DB, not blind copy between providers
- **Deterministic planning before AI** — Rules-based engine first
- **Confirmation before writes** — Assistant actions require explicit approval
- **America/Chicago timezone** — All display and planning calculations use Central Time
