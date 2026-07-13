# Production Deployment

This guide covers the first private production deployment of LifeOS to Vercel with Supabase Auth, Canvas sync, Web Push, and Supabase Cron.

**Scope:** Operations and configuration only. This does not enable Microsoft integration, AI, email, SMS, or workforce import features.

## Prerequisites

- Node.js 20+
- Git repository with LifeOS source code
- Supabase project with migrations applied (`npx supabase db push`)
- Vercel account
- Production domain with HTTPS (Vercel default `*.vercel.app` is acceptable for initial private deployment)

## 1. Git repository preparation

1. Commit all application code and migrations.
2. Confirm `.env.local` is **not** tracked (only `.env.example` should be in version control).
3. Push the deployment branch to your Git remote.
4. Run local verification before deploying:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## 2. Vercel project import

1. Sign in to [Vercel](https://vercel.com).
2. **Add New → Project** and import the LifeOS Git repository.
3. Framework preset: **Next.js** (auto-detected).
4. Node.js version: **20.x** or newer.
5. Build command: `npm run build`
6. Output: default Next.js App Router output (no custom `vercel.json` required).
7. `postinstall` generates PWA icons automatically during install.

## 3. Production environment variables

Set these in **Vercel → Project → Settings → Environment Variables** for the **Production** environment.

### Required for core app

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | Canonical HTTPS origin, e.g. `https://YOUR-PRODUCTION-DOMAIN` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key |
| `APP_ALLOWED_EMAIL` | Single allowed login email |

### Required for Canvas sync

| Variable | Description |
|----------|-------------|
| `TOKEN_ENCRYPTION_KEY` | Base64-encoded 32-byte AES key |
| `CANVAS_ALLOWED_HOSTNAMES` | Comma-separated Canvas hostnames |

### Required for scheduled jobs and push delivery

| Variable | Description |
|----------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only; cron and push delivery) |
| `CRON_SECRET` | Bearer token for cron and readiness endpoints |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID public key |
| `VAPID_PRIVATE_KEY` | VAPID private key (server-only) |
| `VAPID_SUBJECT` | VAPID subject, e.g. `mailto:you@example.com` |

### Keep disabled unless intentionally enabling Microsoft

| Variable | Production value |
|----------|------------------|
| `MICROSOFT_INTEGRATION_ENABLED` | `false` |

Do **not** hardcode a Vercel preview domain in source code. Set `NEXT_PUBLIC_APP_URL` per Vercel environment (Production vs Preview) if you use preview deployments.

See [`.env.example`](../.env.example) for generation commands and descriptions.

## 4. Production deployment

1. Deploy from Vercel (automatic on push to production branch, or manual **Deploy**).
2. Wait for the build to complete successfully.
3. Open the production URL over HTTPS.
4. Confirm PWA assets load: `/manifest.webmanifest`, `/sw.js`, `/icons/icon-192.png`.

## 5. Supabase Auth URL updates

After the production domain exists, update **Supabase Dashboard → Authentication → URL Configuration**:

| Setting | Value |
|---------|-------|
| **Site URL** | `https://YOUR-PRODUCTION-DOMAIN` |
| **Redirect URL** | `https://YOUR-PRODUCTION-DOMAIN/auth/callback` |

Keep local development redirect:

```text
http://localhost:3000/auth/callback
```

The implemented auth callback route is **`/auth/callback`** (App Router route at `src/app/auth/callback/route.ts`). Magic links use `{origin}/auth/callback?next=...` from the login form.

## 6. Canvas connection verification

1. Sign in with `APP_ALLOWED_EMAIL`.
2. Open **Import Center** (`/imports`).
3. Paste a valid Canvas ICS feed URL and click **Save and Connect**.
4. Click **Sync Now** and confirm events/tasks import.
5. Optionally trigger scheduled sync manually (see section 9).

Canvas-specific configuration (`TOKEN_ENCRYPTION_KEY`, `CANVAS_ALLOWED_HOSTNAMES`) is required only for Canvas features. Other pages work without Canvas configuration.

## 7. Push notification verification

1. Confirm VAPID variables are set in Vercel.
2. On iPhone: open the production site in **Safari**, sign in, tap **Share → Add to Home Screen**.
3. Open LifeOS from the Home Screen icon (standalone PWA).
4. Go to **Settings → Notifications**.
5. Click **Enable notifications** and grant permission.
6. Click **Send test notification**.

Push requires HTTPS. iOS push works only from the installed Home Screen PWA, not from a Safari tab.

## 8. Supabase Cron setup

Cron jobs are **not** created automatically by this repository. Configure them manually after deployment.

Store `CRON_SECRET` in **Supabase Vault** or the supported secure dashboard mechanism. Do not commit the secret or production domain in migrations.

### Canvas synchronization

| Setting | Value |
|---------|-------|
| Schedule | `0 */6 * * *` |
| Method | `POST` |
| Path | `/api/cron/canvas-sync` |
| Authorization | `Bearer <CRON_SECRET>` |

### Recurring task materialization

| Setting | Value |
|---------|-------|
| Schedule | `15 2 * * *` |
| Method | `POST` |
| Path | `/api/cron/recurring-tasks` |
| Authorization | `Bearer <CRON_SECRET>` |

Runs daily to materialize upcoming recurring task instances from active templates.

### Notification processing

| Setting | Value |
|---------|-------|
| Schedule | `*/15 * * * *` |
| Method | `POST` |
| Path | `/api/cron/notifications` |
| Authorization | `Bearer <CRON_SECRET>` |

Configure via **Supabase Dashboard → Integrations → Cron**, or SQL with `pg_cron` + `pg_net` referencing Vault secrets. See [integrations.md](integrations.md) for an example SQL pattern.

Microsoft cron (`/api/cron/microsoft-sync`) remains safely disabled while `MICROSOFT_INTEGRATION_ENABLED=false`.

## 9. Health and readiness checks

### Public liveness (no auth)

```bash
curl https://YOUR-PRODUCTION-DOMAIN/api/health
```

Expected response:

```json
{ "status": "ok", "service": "lifeos" }
```

### Protected readiness (CRON_SECRET required)

PowerShell example (use a shell environment variable, never commit the secret):

```powershell
$headers = @{ Authorization = "Bearer $env:LIFEOS_CRON_SECRET" }

Invoke-RestMethod `
  -Method Get `
  -Uri "https://YOUR-PRODUCTION-DOMAIN/api/readiness" `
  -Headers $headers
```

Returns boolean configuration checks only (no secret values, emails, or URLs).

### Manual cron verification

```powershell
$headers = @{ Authorization = "Bearer $env:LIFEOS_CRON_SECRET" }

Invoke-RestMethod `
  -Method Post `
  -Uri "https://YOUR-PRODUCTION-DOMAIN/api/cron/canvas-sync" `
  -Headers $headers

Invoke-RestMethod `
  -Method Post `
  -Uri "https://YOUR-PRODUCTION-DOMAIN/api/cron/recurring-tasks" `
  -Headers $headers

Invoke-RestMethod `
  -Method Post `
  -Uri "https://YOUR-PRODUCTION-DOMAIN/api/cron/notifications" `
  -Headers $headers
```

## 10. Authentication smoke tests

Run manually after deployment:

1. Logged-out `/today` redirects to `/login`.
2. Wrong authenticated email is rejected and signed out.
3. `APP_ALLOWED_EMAIL` login succeeds.
4. Magic link completes at `https://YOUR-PRODUCTION-DOMAIN/auth/callback`.
5. Sign-out returns to `/login`.
6. Protected API routes return `401` without a session.
7. Cron routes return `401` without or with invalid `CRON_SECRET`.
8. Microsoft OAuth routes return `404 MICROSOFT_INTEGRATION_DISABLED`.
9. `GET /api/health` exposes only `{ status, service }`.

## 11. iPhone PWA installation and testing

1. Open `https://YOUR-PRODUCTION-DOMAIN` in Safari.
2. Sign in with the allowed email.
3. **Share → Add to Home Screen**.
4. Launch from the Home Screen icon.
5. Enable notifications from **Settings** (user gesture required).
6. Send a test notification.
7. Tap a notification and confirm navigation stays on an allowed internal route (`/today`, `/week`, `/tasks`, `/settings`).

## 12. Rollback procedure

### Application rollback (Vercel)

1. Open **Vercel → Deployments**.
2. Select the last known-good deployment.
3. Click **Promote to Production** (instant rollback).

### Environment rollback

1. Revert changed environment variables in Vercel to previous values.
2. Redeploy if required.

### Database rollback

LifeOS does not automate database rollback. Restore from a Supabase backup if a migration caused issues.

## 13. Secret rotation

| Secret | Rotation notes |
|--------|----------------|
| `CRON_SECRET` | Generate new value in Vercel and Supabase Vault; update both cron jobs; old secret stops working immediately |
| VAPID keys | Generate new pair; update Vercel env; users must re-subscribe devices |
| `TOKEN_ENCRYPTION_KEY` | **Do not rotate** without re-encrypting stored Canvas credentials |
| `SUPABASE_SERVICE_ROLE_KEY` | Rotate in Supabase; update Vercel immediately |

## 14. Common deployment failures

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Magic link redirects to localhost | Supabase Site URL / redirect URLs not updated | Set production Site URL and `/auth/callback` redirect |
| `NEXT_PUBLIC_APP_URL must use HTTPS` build/runtime error | HTTP URL in production | Set `https://` origin in Vercel |
| Cron returns `401` | Wrong or missing `CRON_SECRET` | Align Vercel and Supabase Cron Authorization header |
| Cron returns `500` configuration error | Missing `CRON_SECRET` or service role key | Set server env vars in Vercel |
| Push enable button disabled | Missing VAPID public key | Set all three VAPID variables |
| iOS push does not work | Opened in Safari tab instead of Home Screen PWA | Reinstall to Home Screen |
| PWA icons missing | `postinstall` did not run | Run `npm run generate-icons` locally or verify Vercel install logs |
| Canvas connect fails | Missing encryption key or hostname allowlist | Set `TOKEN_ENCRYPTION_KEY` and `CANVAS_ALLOWED_HOSTNAMES` |

## Known limitations

- No rate limiting on API routes.
- Cron jobs must be configured manually in Supabase after deploy.
- iOS Web Push requires Home Screen PWA installation.
- Microsoft integration remains disabled unless explicitly enabled.
- Public health endpoint does not verify database connectivity (by design).
- Content Security Policy uses a documented starter policy; further tightening may be needed as Next.js nonce support evolves.

## Related documentation

- [security.md](security.md) — auth model, headers, secret handling
- [integrations.md](integrations.md) — Canvas, push, cron contracts
- [README.md](../README.md) — local development setup
