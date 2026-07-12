# Security

## Authentication

- **Provider:** Supabase Auth
- **Methods:** Email/password and magic link (Phase 1)
- **Public signup:** Disabled — users created manually in Supabase dashboard
- **Session:** HTTP-only cookies managed by `@supabase/ssr`

## Authorization

### Email allowlist

Only the email configured in `APP_ALLOWED_EMAIL` may access the application.

Enforcement points:

1. **Middleware** — Blocks dashboard and API routes for unauthenticated or unauthorized users
2. **Server helpers** — `requireAllowedUser()` throws on mismatch
3. **Auth callback** — Signs out unauthorized users after OAuth/magic link

### Route protection

| Route pattern | Protection |
|---------------|------------|
| `/today`, `/week`, `/tasks`, `/chat`, `/settings`, `/imports` | Middleware + layout `requireAllowedUser()` |
| `/api/*` (except `/api/auth/*`, `/api/health`, `/api/readiness`, `/api/cron/*`) | Middleware |
| `/login` | Public |

## Secret management

### Public (client-safe)

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (Phase 5)

### Server-only (never in client bundles)

- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_ALLOWED_EMAIL` (used in middleware server-side)
- `TOKEN_ENCRYPTION_KEY` (required for Canvas credential encryption)
- `CANVAS_ALLOWED_HOSTNAMES` (required Canvas feed hostname allowlist)
- `CRON_SECRET`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_CLIENT_ID` (server-readable; not required in browser)
- Microsoft MSAL token cache (encrypted in `connections.encrypted_credentials`)
- Graph delta links in `sync_states.sync_cursor` (never sent to browser)
- `VAPID_PRIVATE_KEY`
- Canvas ICS feed URLs (Phase 3)

### Canvas credential encryption (Phase 3)

- Algorithm: AES-256-GCM via Node.js `crypto`
- Key: `TOKEN_ENCRYPTION_KEY` must decode to exactly 32 bytes (base64-encoded)
- Stored format: base64 JSON payload `{ v, iv, tag, data }` with a unique IV per encryption
- Decryption occurs only during server-side feed fetch
- Safe UI display: `Canvas feed configured` (never the full URL)

### Canvas SSRF controls (Phase 3)

- HTTPS-only feed URLs
- Hostname must match `CANVAS_ALLOWED_HOSTNAMES` (explicit configuration required)
- Rejects localhost, loopback, private, and link-local destinations
- Rejects URLs with embedded credentials
- Redirect targets are re-validated (max 3 redirects)
- Request timeout: 15 seconds
- Maximum response size: 5 MB

Environment variables are validated with Zod in `src/lib/security/env.ts`. In production, `NEXT_PUBLIC_APP_URL` must use HTTPS.

## HTTP security headers

LifeOS sets global security headers via `next.config.ts` and `src/lib/security/headers.ts`:

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Frame-Options` | `DENY` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` |
| `Content-Security-Policy` | Starter policy (see below) |

**Starter Content-Security-Policy** (compatible with Next.js, Supabase Auth, service workers, and Web Push):

```text
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self' https://*.supabase.co wss://*.supabase.co;
worker-src 'self';
manifest-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self'
```

This policy intentionally allows inline scripts required by Next.js. Tighten `script-src` when nonce-based CSP is adopted.

`/sw.js` also receives `Cache-Control: no-cache` and `Service-Worker-Allowed: /`.

## Health and readiness endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/health` | None | Public liveness — returns `{ status: "ok", service: "lifeos" }` only |
| `GET /api/readiness` | `CRON_SECRET` Bearer | Protected configuration check — boolean flags only, no secret values |

Neither endpoint performs expensive database operations or returns user data.

## Data retention

- Manual events, tasks, availability rules, and preferences stored in PostgreSQL with RLS
- Provider credentials encrypted in `connections` table (Phase 3)
- Uploaded workforce files will be deleted immediately after processing (Phase 10)
- Audit log for assistant actions via `assistant_actions` (Phase 7)

## Threat considerations

| Threat | Mitigation |
|--------|------------|
| Unauthorized access | Email allowlist + auth required |
| Session hijacking | httpOnly cookies, HTTPS in production |
| Secret exposure | Server-only env vars, no logging of tokens |
| CSRF on mutations | Server actions / API with session auth (Phase 2+) |
| OAuth state tampering | State + nonce validation, PKCE, short-lived encrypted HttpOnly OAuth transaction cookie (Phase 8) |
| Microsoft token theft | MSAL cache encrypted at rest; no tokens in browser storage or URLs |
| Microsoft tenant consent bypass | Safe error on consent denial; no scope escalation or admin-consent bypass |
| Cron endpoint abuse | `CRON_SECRET` Bearer validation with timing-safe compare before admin client (Phase 5–6.6) |
| IDOR on user data | RLS + explicit `user_id` scoping (Phase 2+) |

## Workload calculations (Phase 4)

- All workload queries use the authenticated session client and `requireAllowedUser()`
- Never accept client-supplied `user_id`
- Workload calculations do not fetch `connections` or encrypted Canvas credentials
- `workload_snapshots` rows are owner-scoped via RLS
- Analytical allocations are recommendations only; they do not write calendar events

## Web Push (Phase 5)

- VAPID private key and `CRON_SECRET` are server-only; never logged or returned via API
- Push subscription endpoints and `p256dh`/`auth` keys are never exposed in device list API responses
- `user_id` on subscriptions is derived from the authenticated session, not client input
- Direct `SELECT` on `push_subscriptions` is revoked for `authenticated`; secrets are not readable via PostgREST column projection
- Authenticated subscription management uses narrowly scoped RPC functions returning safe device summaries only
- `createAdminClient()` is used for push **delivery** (cron and test send after `requireAllowedUser()`), not for ordinary settings reads
- Notification click URLs are restricted to same-origin relative routes (`/today`, `/week`, `/tasks`, `/settings`)
- `notification_deliveries` stores audit metadata only — no full subscription or sensitive event text

## Canvas task synchronization (Phase 6.5)

- Task sync runs server-side in the same authenticated session as event sync (manual path)
- `user_id` derived from `requireAllowedUser()`; RLS-scoped Supabase client only (no service role)
- Canvas calendar ownership validated before event/task writes
- Encrypted feed URL never exposed to client
- Client-submitted `user_id`, event ownership, or task ownership fields are not trusted
- Provider updates preserve user-controlled estimate, priority, difficulty, and completion fields

## Scheduled Canvas synchronization (Phase 6.6)

### Privileged trust boundary

| Path | Auth | Database client | Scope |
|------|------|-----------------|-------|
| Manual **Sync Now** | Session + email allowlist | RLS-scoped `createClient()` | Authenticated user's connection |
| Cron `/api/cron/canvas-sync` | `CRON_SECRET` Bearer (timing-safe) | `createAdminClient()` after auth | Each connected `canvas_ics` row from DB query |

Cron endpoint requirements:

- `verifyCronSecret()` runs **before** `createAdminClient()` or any database query
- No `user_id` or `connection_id` accepted from the cron request body
- Administrative queries explicitly filter by `connection.user_id` from the loaded row
- `SUPABASE_SERVICE_ROLE_KEY`, `TOKEN_ENCRYPTION_KEY`, and `CRON_SECRET` remain server-only
- Decrypted feed URLs and raw ICS content are never logged
- Cron response returns operational counts only

### Concurrency protection

- `claim_connection_for_sync` RPC atomically sets `status = syncing` and `last_sync_attempt`
- Concurrent manual and scheduled sync attempts receive `already_running` and are rejected or skipped
- Stale claims (>15 minutes) can be reclaimed
- Success sets `connected` + `last_successful_sync` + `last_sync_trigger`; failure sets `error` + safe `last_error` (never leaves permanent `syncing`)

### Reclassification

- Trustworthy feeds cancel active sync-managed tasks when a UID is reclassified from deadline to class/other

## Microsoft 365 calendar (Phase 8)

### OAuth trust boundary

| Step | Protection |
|------|------------|
| Start route | `requireAllowedUser()` + `APP_ALLOWED_EMAIL`; PKCE verifier stored in encrypted HttpOnly cookie |
| Callback | Session required; state/nonce/PKCE validated; authorization code replay rejected |
| Token persistence | MSAL serialized cache encrypted with `TOKEN_ENCRYPTION_KEY`; never returned to browser |
| Graph access | Server-side only via `acquireTokenSilent()`; cache re-encrypted after refresh |

### Scheduled Microsoft synchronization

| Path | Auth | Database client | Scope |
|------|------|-----------------|-------|
| Manual **Sync Microsoft now** | Session + email allowlist | RLS-scoped `createClient()` | Authenticated user's Microsoft connection |
| Cron `/api/cron/microsoft-sync` | `CRON_SECRET` Bearer (timing-safe) | `createAdminClient()` after auth | Each connected `microsoft` row from DB query |

- `sync_states.sync_cursor` (delta links) never exposed to client
When `MICROSOFT_INTEGRATION_ENABLED` is not `true`, Microsoft OAuth routes return `404 MICROSOFT_INTEGRATION_DISABLED`, the cron route returns `{ enabled: false, ... }` without creating an admin client, and Import Center / Settings hide Microsoft connection controls. Existing synchronized Microsoft data is preserved.
- Read-only events: `is_read_only=true`; direct mutation routes reject Microsoft events
- No `Calendars.ReadWrite`, `Mail.Read`, or application permissions requested

- Partial or suspicious feeds skip reclassification and absence-based cancellation
- Reopening applies only to `cancelled_by_sync` tasks when the assignment returns as a deadline

## Planning proposals (Phase 6)

- Proposal generate/accept/reject uses `requireAllowedUser()`; client-supplied `user_id` is rejected
- Focus-block events may only be created via `accept_planning_proposal` RPC into the **LifeOS Planning** calendar (`source = lifeos`)
- Manual, Canvas, and other calendars cannot receive proposal-created events
- `accept_planning_proposal` revalidates task ownership, open intervals, and workload before insert
- Idempotent accept: repeated accept returns existing `created_event_id` without duplicate events
- Stale proposals are marked when calendar or task state changes between generate and accept
- `remaining_minutes` is not reduced on accept — completion remains a separate user action

## Known limitations (Phase 2)

- No database RLS testing against live Supabase from CI (tests use mocks)
- No rate limiting on mutation endpoints
- Service role client exists but is unused in Phase 2
- Middleware validates only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `APP_ALLOWED_EMAIL` via `safeParse`; missing configuration returns `503` without logging env values
- CSP uses a documented starter policy; further tightening may be needed for stricter script-src control
- Read-only event protection enforced in application layer; RLS does not block updates to `is_read_only` rows (rely on server checks)
- Supabase SSR client requires a type assertion to align `@supabase/ssr` with `SupabaseClient<Database>` generics

## Audit logging

Assistant-created changes are logged in `assistant_actions` (Phase 7). Write commands create a `proposed` action with a server-generated idempotency key; execution requires explicit confirmation within 30 minutes. Clarification state expires after 15 minutes. Structured payloads exclude credentials, feed URLs, and push subscription secrets. The client cannot pass executor or tool names — only validated intent types run on the server.

`assistant_actions` direct authenticated `insert`/`update`/`delete` grants are revoked (Phase 7.1). Browsers may `select` their own rows for display, but all mutations go through SECURITY DEFINER RPCs:

- `create_assistant_action` — server-generated `idempotency_key`, initial status only `proposed` or `awaiting_clarification`
- `reject_assistant_action` — single pending action only
- `reject_pending_assistant_actions` — bulk reject pending/clarification; never touches `executed`
- `expire_stale_assistant_actions` — expire overdue pending actions
- `execute_assistant_action` — idempotent `proposed` → `executed` transition

A database trigger blocks modification of `proposed_payload`, `action_type`, `idempotency_key`, and deletion of `executed` rows.

## Reporting

This is a personal application. Security issues should be addressed directly in the codebase.
