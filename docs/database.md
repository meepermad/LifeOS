# Database

## Status

Phase 2 schema:

```text
supabase/migrations/20260711220000_create_initial_lifeos_schema.sql
```

Phase 3 connections and sync state:

```text
supabase/migrations/20260711240000_create_connections_and_sync_states.sql
```

Phase 8 adds Microsoft 365 calendar support:

```text
supabase/migrations/20260711350000_microsoft_calendar_integration.sql
```

| Table | Phase 8 changes |
|-------|-----------------|
| `connections` | `microsoft` provider; `external_tenant_id`, `external_home_account_id`, `requires_reauthentication`, `credentials_version` |
| `calendars` | `microsoft` source; unique `(connection_id, external_calendar_id)` |
| `sync_states` | Per-calendar `sync_cursor` (Graph delta link), `last_full_sync_at`; unique on `calendar_id` |
| `events` | Outlook metadata: `external_change_key`, `show_as`, `sensitivity`, `organizer_name`, `online_meeting_url` |

Apply to your hosted project with:

```bash
npx supabase link --project-ref fdpulxvzdrfivfvijncd
npx supabase db push
```

Phase 5 adds push subscriptions and notification delivery audit:

```text
supabase/migrations/20260711280000_create_push_notifications.sql
```

Phase 6 adds planning proposals and task-linked focus blocks:

```text
supabase/migrations/20260711300000_create_planning_proposals.sql
```

Phase 6.5 adds Canvas task synchronization metadata:

```text
supabase/migrations/20260711310000_add_canvas_task_sync_metadata.sql
```

Phase 6.6 adds scheduled Canvas sync claim protection and trigger tracking:

```text
supabase/migrations/20260711320000_canvas_sync_claim_and_trigger.sql
```

Phase 7 adds the deterministic planning assistant:

```text
supabase/migrations/20260711330000_create_assistant_tables.sql
```

Phase 7.1 hardens assistant action mutations:

```text
supabase/migrations/20260711340000_harden_assistant_actions_access.sql
```

Adds `assistant_threads`, `assistant_messages`, and `assistant_actions` with owner-only RLS. Links `events.assistant_action_id` to `assistant_actions`. Direct authenticated `insert`/`update`/`delete` on `assistant_actions` are revoked; mutations use SECURITY DEFINER RPCs with state-transition checks. Executed actions are immutable.

## Tables (Phase 2)

| Table | Purpose |
|-------|---------|
| `profiles` | User profile, timezone, week start preference |
| `calendars` | Local and future synced calendar sources |
| `events` | Normalized calendar events |
| `tasks` | Task records with estimates and priority |
| `availability_rules` | Weekly availability windows |
| `planning_preferences` | Buffer, break, and notification settings |
| `connections` | Encrypted provider credentials (Canvas ICS in Phase 3) |
| `sync_states` | Per-connection sync metadata and reconciliation window |
| `workload_snapshots` | Cached daily/weekly workload calculations (Phase 4) |
| `push_subscriptions` | Web Push subscription endpoints per device (Phase 5) |
| `notification_deliveries` | Delivery audit and idempotency (Phase 5) |
| `planning_runs` | Deterministic planning run metadata (Phase 6) |
| `planning_proposals` | Time-of-day focus block proposals (Phase 6) |
| `assistant_threads` | Chat conversation threads (Phase 7) |
| `assistant_messages` | Chat message history (Phase 7) |
| `assistant_actions` | Confirmation-gated write previews and audit (Phase 7) |

Phase 4 adds workload snapshots and event blocking metadata:

```text
supabase/migrations/20260711260000_add_blocks_time_and_workload_snapshots.sql
```

## Ownership model

Every application table includes either:

- `user_id` referencing `auth.users(id)`, or
- `id` / `user_id` equal to `auth.users(id)` for `profiles` and `planning_preferences`

The authenticated Supabase session (`auth.uid()`) must match the row owner for all reads and writes.

## Row-level security

RLS is enabled on every Phase 2 table. Policies target the `authenticated` role only.

| Table | Policy pattern |
|-------|----------------|
| `profiles` | `auth.uid() = id` |
| `calendars` | `auth.uid() = user_id` |
| `events` | `auth.uid() = user_id` |
| `planning_runs` | `auth.uid() = user_id` |
| `planning_proposals` | `auth.uid() = user_id` |
| `assistant_threads` | `auth.uid() = user_id` |
| `assistant_messages` | `auth.uid() = user_id` |
| `assistant_actions` | `auth.uid() = user_id` |
| `workload_snapshots` | `auth.uid() = user_id` |
| `tasks` | `auth.uid() = user_id` |
| `availability_rules` | `auth.uid() = user_id` |
| `planning_preferences` | `auth.uid() = user_id` |
| `connections` | `auth.uid() = user_id` |
| `sync_states` | `auth.uid() = user_id` |
| `push_subscriptions` | RPC-only for `authenticated`; service role for cron delivery |
| `notification_deliveries` | `auth.uid() = user_id` (select only for authenticated; cron uses service role) |

Each table has separate `select`, `insert`, `update`, and (where applicable) `delete` policies with matching `with check` clauses.

Phase 5 hardening (`20260711290000_harden_push_subscriptions_access.sql`):

- Revokes direct `SELECT`/`INSERT`/`UPDATE`/`DELETE` on `push_subscriptions` from `authenticated`
- Authenticated clients use RPC: `register_push_subscription`, `list_push_device_summaries`, `deactivate_push_subscription`, `deactivate_push_subscription_by_endpoint`
- RPC functions return only safe device summary columns (no `endpoint`, `p256dh`, or `auth`)
- Cron and server-side push delivery use the service-role client for full row access

- `notifications_enabled` (default false — explicit opt-in required)
- `notification_privacy_mode` (`private` | `detailed`)
- `daily_notifications_enabled`, `weekly_notifications_enabled`
- `deadline_notifications_enabled`, `overload_notifications_enabled`
- `deadline_warning_hours` (default 24)
- `quiet_hours_start`, `quiet_hours_end`
- Existing: `daily_notification_time`, `weekly_notification_day`, `weekly_notification_time`

Anonymous (`anon`) role grants on application tables are revoked.

## User initialization

On first authenticated dashboard load, `ensureUserInitialized()`:

1. Verifies the allowlisted user
2. Upserts `profiles` with normalized email
3. Ensures `planning_preferences` exists
4. Ensures default calendars exist (idempotent via `unique(user_id, name)`)

Default calendars:

| Name | Source | Writable | Sync |
|------|--------|----------|------|
| Manual | manual | yes | no |
| LifeOS Planning | lifeos | yes | no |
| Home Depot Work | workforce_import | yes | no |
| Canvas | canvas | no | yes |

Initialization uses the authenticated session client only (no service-role key).

## Relationships

```text
auth.users (1) ──► (1) profiles
auth.users (1) ──► (1) planning_preferences
auth.users (1) ──► (many) calendars
auth.users (1) ──► (many) connections
connections (1) ──► (1) sync_states
connections (1) ──► (0..many) calendars [connection_id]
calendars (1) ──► (many) events
auth.users (1) ──► (many) tasks
tasks (0..1) ──► (0..1) events [related_event_id]  (Canvas deadlines)
events (0..1) ──► (0..1) tasks [related_task_id]   (focus blocks, Phase 6)
auth.users (1) ──► (many) planning_runs
planning_runs (1) ──► (many) planning_proposals
planning_proposals (0..1) ──► (0..1) events [created_event_id]
planning_proposals (many) ──► (1) tasks
auth.users (1) ──► (many) availability_rules
auth.users (1) ──► (many) workload_snapshots
```

## Key constraints

- `events.end_at > events.start_at`
- `connections`: one `canvas_ics` or `microsoft` connection per user (partial unique indexes)
- `sync_states`: one row per calendar when `calendar_id` is set (Microsoft); Canvas uses one row for its calendar
- `connections.provider`: `canvas_ics`, `microsoft`
- `connections.status`: `disconnected`, `connected`, `syncing`, `error`
- `connections.last_sync_trigger`: `manual`, `scheduled`, or null
- `connections.requires_reauthentication`: blocks sync until user reconnects (Microsoft)
- `sync_states.sync_cursor`: Graph delta link (server-only; never exposed to browser)
- `unique(calendar_id, external_event_id)` for synced events (nulls allowed for manual events)
- `unique(user_id, name)` on calendars
- `unique(user_id, source, external_task_id)` where external ID is not null
- Canvas tasks: `sync_managed` gates auto-cancel/reopen; `cancelled_by_sync` distinguishes sync vs user cancellation; `source_content_hash` for idempotent provider updates
- Task priority and difficulty between 1 and 5
- Availability `day_of_week` between 0 and 6
- `events.blocks_time` — whether an event consumes availability (deadlines default to `false`)
- `workload_snapshots`: one row per user + period type + period start/end (`unique` constraint)
- `planning_proposals`: `unique(user_id, proposal_hash)`; duration must match `proposed_minutes`
- `events.related_task_id` links confirmed focus blocks to tasks (Phase 6)

## RPC functions (Phase 6)

| Function | Purpose |
|----------|---------|
| `accept_planning_proposal(p_proposal_id)` | Idempotent accept; creates LifeOS Planning focus-block event |
| `reject_planning_proposal(p_proposal_id)` | Marks proposal rejected |

Both use `security invoker` and enforce `auth.uid() = user_id`.

## RPC functions (Phase 6.6)

| Function | Purpose |
|----------|---------|
| `claim_connection_for_sync(p_connection_id, p_stale_minutes)` | Atomically claims a Canvas connection for sync; returns `claimed`, `already_running`, `not_found`, or `not_connected` |

Uses `security definer` with `FOR UPDATE` row lock. When `auth.uid()` is set, ownership is verified. Service role (cron) bypasses session auth but still validates connection state. Stale `syncing` claims older than 15 minutes (default) can be reclaimed.

## RPC functions (Phase 7.1)

| Function | Purpose |
|----------|---------|
| `create_assistant_action(...)` | Creates `proposed` or `awaiting_clarification` action with server-generated idempotency key |
| `reject_assistant_action(p_action_id)` | Rejects one pending action |
| `reject_pending_assistant_actions(p_thread_id)` | Rejects all pending/clarification actions in a thread |
| `expire_stale_assistant_actions(p_thread_id)` | Marks overdue pending actions `expired` |
| `execute_assistant_action(p_action_id, p_executed_payload)` | Idempotent `proposed` → `executed` transition |

All use `security definer` with `set search_path = public`, ownership checks, and explicit state-transition validation. Direct authenticated `insert`/`update`/`delete` on `assistant_actions` are revoked; `select` remains for read-only UI access.

## TypeScript types

Types live in `src/types/database.types.ts`. They were derived from the migration SQL, not generated remotely.

Regenerate after pushing migrations:

```bash
npx supabase gen types typescript --project-id fdpulxvzdrfivfvijncd --schema public > src/types/database.types.ts
```

## Data deletion

- Deleting events/tasks/availability rules removes only the selected row for the authenticated user
- Deleting a calendar cascades to its events
- Deleting an event sets `tasks.related_event_id` to null
- Deleting a connection cascades to its `sync_states` row and clears `calendars.connection_id`
