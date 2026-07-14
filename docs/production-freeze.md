# Production Freeze

Operational freeze checklist for LifeOS after Phase 14. Do not begin another product phase during the freeze.

## Identity

| Field | Value |
|-------|-------|
| Stable release tag | `v14-freeze` (create when you tag after verification) |
| Production domain | Set `NEXT_PUBLIC_APP_URL` (see Vercel project settings) |
| App version label | `NEXT_PUBLIC_APP_VERSION` (optional short label) |

## Required environment variable names (values never recorded here)

Public:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_VERSION` (optional)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

Server:

- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_ALLOWED_EMAIL`
- `TOKEN_ENCRYPTION_KEY`
- `CANVAS_ALLOWED_HOSTNAMES`
- `CRON_SECRET`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

Keep disabled:

- `MICROSOFT_INTEGRATION_ENABLED=false`

Optional AI (if previously enabled, leave unchanged during freeze):

- AI Gateway / OpenAI related vars only if already in production

## Supabase migrations

Latest Phase 14 migration:

- `20260716000000_work_profiles.sql`

Phase 13.1:

- `20260715000000_phase13_1_recurrence_hardening.sql`
- `20260715010000_phase13_1_due_date_revisions.sql`
- `20260715020000_phase13_1_review_constraints.sql`
- `20260715030000_phase13_1_ops.sql`

Verify with `npx supabase migration list` — local and remote versions must match.

## Cron schedules (Supabase Cron → app endpoints)

| Job | Schedule | Path |
|-----|----------|------|
| Canvas sync | `0 */6 * * *` | `POST /api/cron/canvas-sync` |
| Recurring tasks | `15 2 * * *` | `POST /api/cron/recurring-tasks` |
| Notifications | `*/15 * * * *` | `POST /api/cron/notifications` |
| Microsoft sync | configured but gated off | `POST /api/cron/microsoft-sync` |

Authorize with `Bearer <CRON_SECRET>`.

## Active feature flags

- Microsoft integration: **disabled**
- AI intent router: only if already configured; no new AI capability during freeze
- No full offline DB sync

## Backup / export

Use Settings → Export center:

- Calendar ICS
- Tasks / Time / Work CSV
- Complete JSON backup (`schemaVersion: 1`) — archival only; automatic restore is not supported

## Known limitations

- JSON backup cannot be imported automatically
- Draft recovery is localStorage-scoped (device + user), not multi-device sync
- Process-local export rate limits are not shared across instances
- Service worker caches shell assets only; no offline mutation queue
- Unassigned historical work shifts remain valid until assigned

## Health inspection

- Public: `GET /api/health`
- Cron readiness: `GET /api/readiness` with `CRON_SECRET`
- Authenticated UI: `/status`
- Diagnostics: `GET /api/diagnostics/phase13`, `GET /api/diagnostics/timing`

## Roll back Vercel

1. Vercel → Project → Deployments
2. Open the last known-good production deployment
3. Promote / Redeploy as production
4. Confirm `/status` version label and PWA update prompt

## Disable a broken cron job

1. Supabase Dashboard → Cron / scheduled jobs
2. Disable or delete the failing job
3. Fix the underlying route before re-enabling

## Rotate secrets

Rotate one secret at a time: update Vercel env, update Supabase Vault/cron auth if needed, redeploy, verify health. Never commit secret values.

## Reconnect Canvas

1. `/imports` → edit feed URL or reconnect
2. Sync Now
3. Confirm last success on `/status`

## Refresh the PWA

1. Accept “A new version of LifeOS is available” → Reload now
2. Or clear site data for the origin and re-open from Home Screen
3. Timers remain authoritative in the database

## What not to change during the freeze

- Schema beyond emergency hotfixes
- Authentication / RLS policy shape
- Microsoft feature flag
- AI privacy boundaries / intent-router allowlists
- Cron auth mechanism
- Export security headers (`private, no-store`)
- New external integrations
