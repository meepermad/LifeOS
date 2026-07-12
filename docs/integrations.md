# Integrations

## Status by phase

| Integration | Phase | Status |
|-------------|-------|--------|
| Manual events/tasks | 2 | Complete |
| Canvas ICS | 3 | Complete |
| Microsoft Graph | 8 | Complete (disabled by default via `MICROSOFT_INTEGRATION_ENABLED=false`) |
| Workforce weekly form | 9 | Planned |
| Web push | 5 | Complete |
| Email task candidates | 11 | Deferred |

## Canvas ICS (Phase 3)

### Finding your feed URL

1. Open Canvas in a browser and sign in.
2. Go to **Calendar**.
3. Open **Calendar Feed** (or **Subscribe to Calendar Feed**).
4. Copy the private HTTPS `.ics` URL.

Treat this URL as a credential. Anyone with the URL can read your Canvas calendar data.

### Configuration

Set these server-only environment variables before connecting Canvas:

| Variable | Purpose |
|----------|---------|
| `TOKEN_ENCRYPTION_KEY` | Encrypts the feed URL at rest (32-byte key, base64-encoded) |
| `CANVAS_ALLOWED_HOSTNAMES` | Comma-separated hostname allowlist (no default) |

PowerShell key generation:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### Connection workflow

1. Open **Import Center** (`/imports`).
2. Paste the Canvas ICS feed URL into the password-style field.
3. Click **Save and Connect**. The URL is encrypted server-side and never shown again.
4. Click **Sync Now** to import events into the default **Canvas** calendar.

### Synchronization behavior

- **Method:** Server-side HTTPS fetch of the private ICS feed
- **Storage:** Encrypted in `connections.encrypted_credentials`
- **Target calendar:** Default `Canvas` calendar (`source = canvas`, read-only)
- **Identifier:** ICS `UID` stored as `external_event_id`
- **Deduplication:** `unique(calendar_id, external_event_id)` plus `content_hash`
- **Manual and scheduled sync:** Import Center **Sync Now** for immediate refresh; Supabase Cron calls `/api/cron/canvas-sync` every 6 hours after deployment

### Event normalization

| ICS signal | LifeOS mapping |
|------------|----------------|
| `UID` | `external_event_id` |
| `SUMMARY` | `title` |
| `DESCRIPTION` | `description` |
| `LOCATION` | `location` |
| `DTSTART` / `DTEND` | `start_at` / `end_at` (UTC) |
| All-day `VALUE=DATE` | `all_day = true` |
| Floating times (no zone) | Interpreted as `America/Chicago` |
| `STATUS:CANCELLED` | `status = cancelled` |
| Assignment / due patterns | `event_type = deadline` |
| Class / lecture patterns | `event_type = class` |
| Otherwise | `event_type = other` |

Imported events are stored with `source = canvas` and `is_read_only = true`.

### Removed-event strategy

Canvas ICS feeds may only include a limited date range. LifeOS therefore:

1. Derives a sync window from the min/max timestamps in the current feed.
2. Tracks external IDs seen in the successful sync.
3. Marks in-window local Canvas events missing from the feed as `cancelled` (not deleted).
4. Leaves events outside the sync window untouched.
5. Skips reconciliation when the feed looks incomplete (for example, far fewer events than the previous sync).
6. Never reconciles after a failed or partial fetch.

### Disconnecting

Use **Disconnect** in Import Center to delete the stored connection and credentials. Previously synced events remain in the database until you remove them manually.

### Canvas deadline events and assignment tasks (Phase 6.5)

Canvas synchronization creates **two linked records** for every confidently classified assignment:

| Record | Role | Key fields |
|--------|------|------------|
| **Event** | Due date on the calendar | `source=canvas`, `event_type=deadline`, `is_read_only=true`, `blocks_time=false` |
| **Task** | Work required | `source=canvas`, `external_task_id=ICS UID`, `related_event_id`, null estimates until user enters them |

**Classification (deterministic, no LLM):** title/description regex in `normalize.ts` — `deadline` patterns win over `class` patterns. Class meetings, office hours, and `other` entries do not get tasks.

**Task sync idempotency:** `unique(user_id, source, external_task_id)` plus `source_content_hash` on tasks. Repeated unchanged syncs create no duplicates.

**Provider-controlled task fields:** `title`, `description`, `due_at`, `external_task_id`, `related_event_id`, sync metadata, cancellation under conservative rules.

**User-controlled task fields (preserved on resync):** `estimated_minutes`, `remaining_minutes`, `actual_minutes`, `priority`, `difficulty`, `earliest_start_at`, `splittable`, `minimum_block_minutes`, active/completed status.

**Estimate workflow:** Sync creates tasks with null estimates. User clicks **Estimate workload** on Today/Week or edits from Tasks. Workload engine counts unestimated tasks as incomplete data; planning skips them until estimated.

**Cancellation:** Sync-managed active tasks are set `cancelled` with `cancelled_by_sync=true` when the Canvas assignment is cancelled or safely reconciled as removed. Completed and user-cancelled tasks are never auto-cancelled or auto-reopened. Sync-cancelled tasks may reopen when the assignment reappears.

**Manual conversion compatibility:** Tasks created before Phase 6.5 via the old conversion flow are matched by `external_task_id` or `related_event_id` and claimed as `sync_managed` on first sync.

### Canvas deadline → task estimate (replaces Phase 4 manual creation)

After Phase 6.5, Canvas sync automatically creates linked tasks. To include assignment workload in capacity calculations:

1. Sync Canvas from **Import Center** (creates deadline event + linked task).
2. Open **Today**, **Week**, or **Tasks** and click **Estimate workload** on the assignment.
3. Enter estimated minutes plus optional priority, difficulty, splittable status, and minimum block size.
4. LifeOS updates the existing `canvas` task — it does not create a duplicate.

The Canvas deadline event itself is never modified.

### Sync result format

Import Center reports separate event and assignment counts:

```text
Events: 2 created, 1 updated, 14 unchanged
Assignments: 2 tasks created, 1 updated, 7 unchanged
3 personal estimates preserved
```

### Known limitations

- Feed date-range limits can delay removal detection.
- Recurring events are imported as single entries when expansion is unsafe.
- Hostname allowlist must be configured explicitly.
- Classification is regex-based; misclassified entries remain event-only until the next trustworthy sync.
- Partial or suspicious feeds skip removal reconciliation and reclassification cancellation.

### Scheduled Canvas synchronization (Phase 6.6)

Automatic sync runs approximately every 6 hours via Supabase Cron after deployment:

| Setting | Value |
|---------|-------|
| HTTP method | `POST` |
| URL | `https://<production-domain>/api/cron/canvas-sync` |
| Schedule | `0 */6 * * *` |
| Authorization | `Bearer <CRON_SECRET>` |

Store `CRON_SECRET` in Supabase Vault or the supported secure dashboard mechanism. Do not commit the secret or deployment URL in migrations.

The cron endpoint:

- Authenticates with timing-safe `CRON_SECRET` validation **before** creating the administrative Supabase client
- Processes all connected `canvas_ics` connections (no hardcoded user UUID)
- Uses the shared `syncCanvasForUser()` service (same pipeline as manual **Sync Now**)
- Returns operational counts only — never feed URLs, credentials, titles, or user email
- Does not send push notifications on sync success
- Continues processing other connections if one fails

Import Center shows last sync attempt, last successful sync, whether the last success was manual or automatic, and a note about periodic sync.

### Reclassification cleanup (Phase 6.6)

When a Canvas UID remains in the feed but is reclassified from deadline to class or other:

- Active sync-managed tasks are cancelled with `cancelled_by_sync = true`
- Estimates, planning fields, and focus blocks are preserved; tasks are not deleted
- Completed tasks and user-cancelled tasks are not modified
- When the assignment returns as a deadline, only `cancelled_by_sync` tasks are reopened

Absence from the feed still uses conservative removal reconciliation (skipped on failed or partial feeds).

## Microsoft (Phase 8)

Microsoft integration is **disabled by default**. Set `MICROSOFT_INTEGRATION_ENABLED=true` and configure the Entra app variables before connecting.

- **Feature flag:** `MICROSOFT_INTEGRATION_ENABLED` (default `false`)
- **Method:** OAuth 2.0 authorization code flow with PKCE via `@azure/msal-node`
- **Permissions:** Read-only delegated scopes only (`Calendars.Read`, not `Calendars.ReadWrite`)
- **Account types:** Work or school accounts (`MICROSOFT_TENANT_ID=organizations` or a specific tenant)
- **Token storage:** Encrypted MSAL serialized token cache in `connections.encrypted_credentials`
- **Safe metadata:** `display_name`, `external_tenant_id`, `external_home_account_id` only
- **Calendar discovery:** `GET /me/calendars` after connect; primary calendar selected by default
- **Sync window:** 30 days past, 180 days future (UTC); reset when window end is within 7 days
- **Delta sync:** Per-calendar `calendarView/delta` with `sync_states.sync_cursor`
- **Immutable IDs:** Graph requests use `Prefer: IdType="ImmutableId"`
- **Events:** `source=microsoft`, `is_read_only=true`; no bodies, attendees, or attachments stored
- **Private events:** Title may be stored as `Private event` when sensitivity is private/confidential
- **Blocking:** `showAs=free` and cancelled events do not block workload capacity
- **No task auto-creation** from ordinary Outlook meetings
- **Manual sync:** Import Center → **Sync Microsoft now**
- **Scheduled sync:** `POST /api/cron/microsoft-sync` hourly (`0 * * * *`) with `CRON_SECRET`
- **Disconnect:** Removes local credentials, calendars, events, and sync cursors; does not delete Outlook data
- **Reauthentication:** `requires_reauthentication` when refresh fails; **Connect Again** in Import Center

### OAuth routes

| Route | Purpose |
|-------|---------|
| `GET /api/auth/microsoft/start` | Begin OAuth (authenticated LifeOS session required) |
| `GET /api/auth/microsoft/callback` | Complete OAuth, encrypt token cache, discover calendars |

### Entra app registration

1. App type: Web (confidential client)
2. Supported account types: **Accounts in any organizational directory**
3. Redirect URI: exact match for `MICROSOFT_REDIRECT_URI`
4. Delegated permissions: `openid`, `profile`, `offline_access`, `User.Read`, `Calendars.Read`
5. Do **not** request `Calendars.ReadWrite`, `Mail.Read`, or application permissions

### Supabase Cron (Microsoft)

```sql
select net.http_post(
  url := 'https://YOUR_DOMAIN/api/cron/microsoft-sync',
  headers := jsonb_build_object(
    'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
  )
);
```

Schedule: `0 * * * *` (hourly)

### Known limitations

- Organizational consent may block connection; LifeOS surfaces a safe error and does not bypass tenant policy
- No Outlook write-back in Phase 8
- Delta cursors expire (`410 Gone`); LifeOS resets and performs a full resync for that calendar
- Graph throttling (`429`) is retried with `Retry-After`
- K-State or other tenant approval must be tested with a real account after Entra registration

## Work schedule (Phase 9)

- **Method:** Structured weekly form at `/work` (no scraping)
- **Storage:** Shifts as `event_type: work` events on the **Work** calendar
- **Identifier:** `external_event_id = work-shift:{yyyy-MM-dd}`
- **Assistant:** Deterministic work-schedule commands with confirmation previews
- **Shortcuts:** `POST /api/shortcuts/command` with per-device tokens (see [shortcuts.md](shortcuts.md))

## Push notifications (Phase 5)

- **Protocol:** Web Push with VAPID (`web-push` npm package)
- **Subscriptions:** `push_subscriptions` table; authenticated clients use RPC (no direct secret column access)
- **Delivery audit:** `notification_deliveries` with deduplication keys
- **Privacy modes:** `private` (lock-screen safe) or `detailed` (summary metrics only)
- **iPhone requirement:** PWA must be added to Home Screen; Safari tab mode does not support push
- **Permission:** Requested only on explicit user action (Enable notifications button)
- **Service worker:** `public/sw.js` handles `push` and `notificationclick` with same-origin route allowlist
- **Scheduled delivery:** `POST /api/cron/notifications` every 15 minutes (America/Chicago scheduling)
- **Invalid subscriptions:** HTTP 404/410 responses mark subscriptions inactive

### Subscription lifecycle

1. User opens Settings → Notifications and clicks **Enable notifications**.
2. Browser permission is requested (user gesture only).
3. Service worker registers; `PushManager.subscribe` uses `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
4. Server action upserts subscription by endpoint; `notifications_enabled` is set true.
5. **Disable this device** calls `unsubscribe()` and deactivates the matching endpoint.
6. Other devices can be deactivated from Settings without affecting the current device.

### Supabase Cron configuration

Do not commit secrets. Store `CRON_SECRET` in Supabase Vault and invoke your deployed endpoints:

**Notifications (every 15 minutes):**

- **Schedule:** `*/15 * * * *`
- **Method:** `POST`
- **URL:** `https://<your-domain>/api/cron/notifications`
- **Header:** `Authorization: Bearer <CRON_SECRET from Vault>`

**Canvas sync (every 6 hours):**

- **Schedule:** `0 */6 * * *`
- **Method:** `POST`
- **URL:** `https://<your-domain>/api/cron/canvas-sync`
- **Header:** `Authorization: Bearer <CRON_SECRET from Vault>`

Configure via Supabase Dashboard → Integrations → Cron, or SQL with `pg_cron` + `pg_net` using Vault references.

See [deployment.md](deployment.md) for the full production cron setup runbook.

### Deployment prerequisites for push

Scheduled and iPhone push will not work until:

1. App is deployed over public HTTPS
2. Production environment variables are configured (VAPID, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`)
3. Supabase Auth redirect URLs are configured for production
4. PWA is installed on iPhone Home Screen (for iOS)
5. Notification permission is granted via user action
6. Supabase Cron job is configured

### Known limitations

- iOS requires installed PWA; no push in Safari tab
- Single-user app; cron processes the allowlisted user only
- Test notifications are rate-limited (~1 per minute)
- Deadline/overload warnings are grouped and deduplicated conservatively
- Database timestamps remain UTC; scheduling logic uses `America/Chicago`

## Future: Email integration (Phase 11)

- Process only approved senders/folders
- Create task candidates, not automatic tasks
- Store minimal metadata only
- Require user review
- Do not store full message bodies

## Integration principles

1. External calendars are sources of truth
2. Sync into normalized database, not between external calendars
3. Server-side only for credentials and fetching
4. Idempotent synchronization
5. Provider failures must not break unrelated features
