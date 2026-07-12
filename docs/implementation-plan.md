# Implementation Plan

## Development phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | Private PWA shell | ✅ Complete |
| 2 | Database and manual data | ✅ Complete |
| 3 | Canvas synchronization | ✅ Complete |
| 4 | Workload engine | ✅ Complete |
| 5 | Push notifications | Complete |
| 6 | Planning proposals | Complete |
| 6.5 | Canvas task auto-sync | Complete |
| 7 | Deterministic chat commands | Complete |
| 8 | Microsoft integration | Complete (disabled by default) |
| 9 | Home Depot weekly import | Planned |
| 10 | File-based workforce import | Deferred |
| 11 | Email task candidates | Deferred |

## Phase 2 — Completed items

- [x] Initial SQL migration with profiles, calendars, events, tasks, availability_rules, planning_preferences
- [x] RLS on all Phase 2 tables (authenticated role only)
- [x] Grants and anon revocation on application tables
- [x] `set_updated_at()` trigger function
- [x] Idempotent `ensureUserInitialized()` with default calendars
- [x] Typed Supabase clients (`Database` types derived from migration)
- [x] Zod validation for events, tasks, availability, preferences
- [x] America/Chicago date conversion utilities
- [x] Data-access layer (`src/lib/data/`)
- [x] Server actions for CRUD and settings
- [x] Manual event CRUD with read-only protection
- [x] Task CRUD with complete/reopen behavior
- [x] Availability rule management
- [x] Planning preference management
- [x] Functional Today, Week, Tasks, and Settings screens
- [x] Unit and component tests (23 passing)
- [x] Documentation updates

## Phase 2 — Known limitations

- Migration prepared but **not applied remotely** from this environment (requires `supabase login` + `db push`)
- Week view is a seven-day agenda, not a full calendar grid
- No workload calculations yet
- No Canvas, Microsoft, or workforce sync
- Chat remains a placeholder
- Database types are migration-derived, not yet regenerated from remote
- `SUPABASE_SERVICE_ROLE_KEY` unused (by design)
- Default calendars cannot be deleted from Settings
- Notification preference fields are stored only (push in Phase 5)

## Phase 3 — Completed items

- [x] `connections` and `sync_states` tables with RLS
- [x] AES-256-GCM credential encryption for Canvas ICS feed URLs
- [x] SSRF-safe server-side ICS fetch with hostname allowlist
- [x] ICS parse and normalize (`node-ical`) with America/Chicago floating times
- [x] Idempotent Canvas event upserts into default Canvas calendar
- [x] Safe removed-event reconciliation (cancel in-window, skip incomplete feeds)
- [x] Import Center UI for connect, sync, replace, disconnect
- [x] Canvas badge and read-only protection in Today/Week views
- [x] Unit tests for validation, encryption, parsing, sync, and safe responses
- [x] Documentation updates

## Phase 3 — Known limitations

- Manual sync only in Phase 3 (scheduled sync added in Phase 6.6)
- Migration prepared but **not applied remotely** from this environment (requires `supabase login` + `db push`)
- Canvas hostname allowlist must be configured explicitly
- ICS feed date-range limits can delay absent-event detection
- Recurring events are not expanded

## Phase 4 — Completed items

- [x] `events.blocks_time` column with deadline backfill
- [x] `workload_snapshots` table with RLS, constraints, and upsert caching
- [x] Pure planning engine in `src/lib/planning/`
- [x] Daily and weekly capacity calculations (America/Chicago)
- [x] Analytical task allocation (no calendar writes)
- [x] Canvas deadline → task conversion workflow
- [x] Today workload summary replacing Phase 2 placeholder
- [x] Week workload summary with per-day metrics
- [x] Tasks workload filters and risk indicators
- [x] Responsive desktop layouts for Today and Week (`lg` / `xl` containers)
- [x] Unit and component tests for planning, snapshots, and UI
- [x] Documentation updates

## Phase 4 — Capacity formula

```text
availability_minutes     = merged enabled availability windows
blocking_minutes         = merged blocking intervals within availability
raw_open_minutes         = max(0, availability - blocking)
reserved_buffer_minutes  = floor(raw_open × planning_buffer_percent / 100)
available_focus_minutes  = max(0, raw_open - reserved_buffer)
capacity_ratio           = allocated_task_minutes / available_focus_minutes
```

## Phase 4 — Blocking rules

- Blocking types: class, work, meeting, appointment, focus_block, travel, personal, meal, exercise
- Non-blocking: deadline, cancelled, tentative (warning only), `blocks_time = false`
- All-day blocking events consume the full availability window for that day (conservative)
- All-day deadlines never block

## Phase 4 — Buffer rules

- Travel buffer applied once around class/work/meeting/appointment before merge
- `minimum_break_minutes` is informational in this phase (not subtracted from capacity)
- Planning buffer reserved from raw open minutes after fixed commitments

## Phase 4 — Known limitations

- Analytical allocations do not create focus-block calendar events
- Tentative events warn but do not reduce capacity
- No time-of-day focus recommendations
- Snapshot cache refreshes on page load (hash-skipped upsert when unchanged)
- Migration prepared locally; apply with `npx supabase db push`

## Phase 5 — Push notifications (Complete)

- `push_subscriptions` and `notification_deliveries` migration
- VAPID Web Push with `web-push` library
- Service worker `push` and `notificationclick` handlers
- Settings → Notifications UI (enable/disable, test, preferences, devices)
- Privacy modes: `private` and `detailed`
- Daily agenda and weekly workload notifications from planning engine
- Deadline and overload warning preparation with deduplication
- Protected `POST /api/cron/notifications` endpoint
- Invalid subscription cleanup on HTTP 404/410
- Push subscription secrets hardened: authenticated clients use RPC only (`20260711290000_harden_push_subscriptions_access.sql`)
- Unit tests with mocked Web Push transport

## Phase 5 — Known limitations

- iOS requires Home Screen PWA installation
- Cron job must be configured manually in Supabase (not in migration)
- Single-user processing via allowlisted email
- Test notifications rate-limited to ~1 per minute
- Migration prepared locally; apply with `npx supabase db push`

## Phase 5 — Recommended next phase

**Phase 6 — Planning proposals:** deterministic scheduling suggestions without automatic calendar writes. *(Complete — see Phase 6 section below.)*

## Phase 6 — Planning proposals (Complete)

- `events.related_task_id` for focus-block ↔ task linkage
- `planning_runs` and `planning_proposals` tables with RLS
- Pure proposal engine: open intervals, focus blocks, explanations, validation
- `accept_planning_proposal` / `reject_planning_proposal` RPCs (idempotent accept)
- Today **Plan today** and Week **Generate weekly plan** UI
- Accept / reject / regenerate / accept selected (week)
- Tasks page focus-schedule summary (remaining, scheduled, unscheduled, next block)
- Unit and component tests

## Phase 6 — Confirmation workflow

1. User generates a planning run (no calendar writes).
2. Proposals are stored with structured explanations and hashes.
3. On accept, server revalidates freshness, then RPC creates a LifeOS Planning `focus_block` event.
4. `remaining_minutes` on tasks is **not** reduced automatically.
5. Regeneration marks prior pending proposals stale; accepted events remain blocking.

## Phase 6 — Known limitations

- Tentative events warn but do not block (unchanged from Phase 4)
- Per-day `availability_rules.maximum_focus_minutes` stored but not consumed
- No automatic background regeneration when calendar changes
- Focus blocks created before migration lack `related_task_id` until re-created
- Migration prepared locally; apply with `npx supabase db push`

## Phase 6 — Recommended next phase

**Phase 6.5 — Automatic Canvas assignment task synchronization:** auto-create linked tasks on sync. *(Complete — see Phase 6.5 section below.)*

## Phase 6.6 — Scheduled Canvas sync (Complete)

- [x] Shared `syncCanvasForUser()` service for manual and scheduled execution
- [x] `claim_connection_for_sync` RPC with 15-minute stale-claim recovery
- [x] `POST /api/cron/canvas-sync` with auth-before-admin pattern
- [x] `last_sync_trigger` on connections
- [x] Reclassification cleanup for deadline→class/other
- [x] Import Center automatic-sync status
- [x] Unit tests for cron, concurrency, and reclassification
- [x] Documentation updates

## Phase 6.6 — Known limitations

- Regex classification may miss or misclassify assignments
- Feed date-range limits delay removal detection
- Automatic sync requires deployed HTTPS URL and Supabase Cron configuration
- Reclassification and absence cancellation skipped on partial/suspicious feeds
- Migration prepared locally; apply with `npx supabase db push`

## Phase 6.6 — Recommended next phase

**Phase 7 — Deterministic chat commands:** wire proposal generate/accept/reject into chat. *(Complete — see Phase 7 section below.)*

## Phase 7 — Completed items

- [x] `assistant_threads`, `assistant_messages`, `assistant_actions` tables with RLS
- [x] Deterministic parser in `src/lib/assistant/` (no LLM)
- [x] Clarification flow for missing duration, dates, and ambiguous task matches
- [x] Confirmation-gated writes with idempotency keys and 30-minute expiration
- [x] Reuse of workload engine, open intervals, planning generation, and proposal RPCs
- [x] Manual calendar event creation with `created_by_assistant`
- [x] Assistant task creation with `source = assistant`
- [x] Chat UI at `/chat` with previews, suggested commands, and mobile-first layout
- [x] Unit and component tests for parser, clarification, DST, and UI
- [x] Documentation updates

## Phase 7 — Supported commands

- Agenda: today, tomorrow, specific date, this week
- Workload: today, this week, how busy is [day]
- Availability: find N minutes, time-of-day preference, before deadline
- Planning: plan today/week, accept/reject proposals, regenerate
- Writes (confirmed): create event, create task, complete task, clear chat
- Meta: `help`, `clear chat`

## Phase 7 — Known limitations

- Fixed command vocabulary; unknown phrases receive an honest unsupported response
- No event move/delete via chat
- No LLM or external AI provider
- Single active chat thread per user
- Migration prepared locally; apply with `npx supabase db push`

## Phase 7 — Recommended next phase

**Phase 8 — Microsoft integration** *(Complete — see Phase 8 section below.)*

## Phase 8 — Microsoft 365 calendar (Complete)

- [x] Migration `20260711350000_microsoft_calendar_integration.sql`
- [x] OAuth + PKCE routes (`/api/auth/microsoft/start`, `/api/auth/microsoft/callback`)
- [x] Encrypted MSAL token cache in `connections.encrypted_credentials`
- [x] `src/lib/integrations/microsoft/*` (config, oauth, token-cache, graph-client, calendars, normalize, sync)
- [x] Per-calendar Graph `calendarView/delta` sync with `sync_states.sync_cursor`
- [x] Feature flag `MICROSOFT_INTEGRATION_ENABLED` (default disabled)
- [x] Import Center UI + Settings connection status (hidden when flag is off)
- [x] Manual sync + `POST /api/cron/microsoft-sync`
- [x] Generalized `claim_connection_for_sync` RPC for Canvas and Microsoft
- [x] Unit tests (OAuth, token cache, graph client, normalize, sync, cron, regression)
- [x] Documentation updates

## Phase 8 — Known limitations

- Organizational consent may block work/school accounts until tenant admin approval
- No Outlook write-back, email, Teams, or To Do integration
- Delta sync window must be periodically reset as boundaries age
- Entra registration and K-State consent must be verified manually after deployment

## Production deployment prep

- [x] Production HTTPS validation for `NEXT_PUBLIC_APP_URL`
- [x] Node runtime declarations on cron and Microsoft routes
- [x] Global security headers and starter CSP
- [x] Public health endpoint (`GET /api/health`)
- [x] Protected readiness endpoint (`GET /api/readiness`)
- [x] Deployment runbook ([deployment.md](deployment.md))
- [x] Cron and auth operational tests
- [ ] Vercel production deploy (manual)
- [ ] Supabase Auth production URL configuration (manual, after domain exists)
- [ ] Supabase Cron jobs created and tested (manual)

See [deployment.md](deployment.md) for exact Vercel, Supabase Auth, cron, and iPhone PWA steps.

## Phase 8 — Recommended next phase

**Phase 9 — Workforce import**

## Phase 6.5 — Canvas task auto-sync (Complete)

- [x] `sync_managed`, `source_content_hash`, `cancelled_by_sync` on `tasks`
- [x] Batch task upsert in `src/lib/integrations/canvas/task-sync.ts`
- [x] Nested sync result `{ events, tasks, warnings }`
- [x] Idempotent task creation for `event_type=deadline` only
- [x] User-field preservation on resync
- [x] Conservative cancellation and sync-cancelled reopen
- [x] Manual conversion compatibility via `external_task_id` / `related_event_id`
- [x] Estimate workflow replaces task creation (`updateCanvasTaskEstimateAction`)
- [x] Today / Week / Tasks / Import Center UI updates
- [x] Workload and proposal integration tests
- [x] Documentation updates

## Phase 6.5 — Event vs task model

- **Event:** read-only Canvas deadline on calendar (`blocks_time=false`)
- **Task:** work item with null estimates until user enters them
- **Classification:** deterministic regex on title/description; no LLM

## Phase 6.5 — Known limitations

- Regex classification may miss or misclassify assignments
- Feed date-range limits delay removal detection
- Migration prepared locally; apply with `npx supabase db push`

## Phase 6.5 — Recommended next phase

**Phase 6.6 — Scheduled Canvas synchronization:** automatic 6-hour sync, concurrency protection, reclassification cleanup. *(Complete — see Phase 6.6 section above.)*

## Phase 5 — Recommended first tasks

1. Apply Phase 5 migration to hosted Supabase
2. Configure VAPID keys and `CRON_SECRET` in production
3. Set up Supabase Cron to call `/api/cron/notifications` every 15 minutes
4. Install PWA on iPhone Home Screen and enable notifications
5. Send a test notification from Settings

## Phase 4 — Recommended next phase

**Phase 5 — Push notifications:** daily/weekly summaries from `workload_snapshots` and notification preferences. *(Complete — see Phase 5 section above.)*

## Phase 4 — Recommended first tasks

1. Apply Phase 4 migration to hosted Supabase if not done yet
2. Configure availability rules in Settings
3. Sync Canvas and estimate workload on assignment tasks
4. Review Today and Week workload summaries

## Blockers

- Remote migration requires your Supabase CLI login (`npx supabase login`)

## Deferred work

Unchanged from Phase 1 plus: OCR workforce import, AI chat, email integration, full offline sync.
