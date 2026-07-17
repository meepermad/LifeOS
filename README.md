# LifeOS

Private personal planning and workload management PWA. LifeOS aggregates schedules, assignments, tasks, work shifts, and personal commitments into one master planning system.

**Current phase:** Release Candidate 1 (RC1) — product polish for daily personal use

## Technology stack

- Next.js 15 (App Router)
- TypeScript
- React 19
- Tailwind CSS 4
- Supabase Auth + PostgreSQL (RLS)
- date-fns / date-fns-tz (America/Chicago)
- Zod (validation)
- Vitest (unit tests)

## Local setup

### Prerequisites

- Node.js 20+
- npm
- A Supabase project

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

Required for Phase 1:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | App URL — use `http://localhost:3000` locally; **HTTPS required in production** (e.g. `https://YOUR-PRODUCTION-DOMAIN`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key |
| `APP_ALLOWED_EMAIL` | Your single allowed login email |
| `TOKEN_ENCRYPTION_KEY` | Base64-encoded 32-byte AES key (required for Canvas sync) |
| `CANVAS_ALLOWED_HOSTNAMES` | Comma-separated Canvas hostnames (required for Canvas sync) |

Phase 5 (Web Push — optional until you enable notifications):

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Browser-safe VAPID public key |
| `VAPID_PRIVATE_KEY` | Server-only VAPID private key |
| `VAPID_SUBJECT` | VAPID subject (e.g. `mailto:you@example.com`) |
| `CRON_SECRET` | Protects scheduled notification and sync endpoints |
| `SUPABASE_SERVICE_ROLE_KEY` | Cron background processing only |

Generate VAPID keys:

```bash
npx web-push generate-vapid-keys
```

Generate a cryptographically secure cron secret in PowerShell:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Phase 8 (Microsoft 365 calendar — **disabled by default**):

| Variable | Description |
|----------|-------------|
| `MICROSOFT_INTEGRATION_ENABLED` | Set to `true` to show Microsoft UI and allow OAuth/sync (default: disabled) |
| `MICROSOFT_CLIENT_ID` | Entra app (client) ID — required only when integration is enabled |
| `MICROSOFT_CLIENT_SECRET` | Entra app client secret (server-only) — required only when enabled |
| `MICROSOFT_TENANT_ID` | `organizations` or a specific tenant ID — required only when enabled |
| `MICROSOFT_REDIRECT_URI` | Must exactly match Entra redirect URI — required only when enabled |

Register an Entra app with **Accounts in any organizational directory**, delegated scopes `openid`, `profile`, `offline_access`, `User.Read`, `Calendars.Read` only. See [docs/integrations.md](docs/integrations.md).

Generate an encryption key in PowerShell:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Example Canvas hostname configuration:

```text
CANVAS_ALLOWED_HOSTNAMES=k-state.instructure.com
```

### 3. Apply database migrations

Install the [Supabase CLI](https://supabase.com/docs/guides/cli) if needed, then:

```bash
npx supabase login
npx supabase link --project-ref fdpulxvzdrfivfvijncd
npx supabase db push
```

Optional dry run:

```bash
npx supabase db push --dry-run
```

Regenerate TypeScript types after pushing (use UTF-8 on Windows):

```powershell
npx supabase gen types typescript --project-id fdpulxvzdrfivfvijncd --schema public | Out-File -Encoding utf8 src/types/database.types.ts
```

Using `>` in PowerShell writes UTF-16 and can break ESLint. Application row aliases and enums are in `src/types/domain.ts` — regenerate only `database.types.ts`.

### 4. Supabase Auth configuration

1. Create a project at [supabase.com](https://supabase.com).
2. Go to **Project Settings → API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` / publishable key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Go to **Authentication → Providers → Email** and enable email provider.
4. **Disable public signups:**
   - Go to **Authentication → Providers → Email**
   - Turn off "Enable sign ups" (or use Dashboard → Auth → Settings)
   - Alternatively, keep signups disabled via **Authentication → Settings → "Allow new users to sign up"** = off
5. Create your user manually:
   - Go to **Authentication → Users → Add user**
   - Enter the same email as `APP_ALLOWED_EMAIL`
   - Set a password (or use magic link)
6. For magic link / OAuth redirects, add to **Authentication → URL Configuration**:
   - Site URL: your app URL (e.g. `http://localhost:3000` locally, `https://YOUR-PRODUCTION-DOMAIN` in production)
   - Redirect URLs: `http://localhost:3000/auth/callback` (local) and `https://YOUR-PRODUCTION-DOMAIN/auth/callback` (production)

   The implemented callback path is **`/auth/callback`** (`src/app/auth/callback/route.ts`).

### Production deployment

See [docs/deployment.md](docs/deployment.md) for Vercel import, environment variables, Supabase Cron, health checks, rollback, and iPhone PWA testing.

### 5. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Run tests

```bash
npm test
```

### 7. Production build

```bash
npm run build
npm start
```

## PWA installation

### Desktop (Chrome / Edge)

1. Open the app while signed in.
2. Click the install icon in the address bar, or use the browser menu → **Install LifeOS**.

### iPhone (Safari)

1. Open the app in Safari while signed in.
2. Tap **Share** → **Add to Home Screen**.
3. The app opens in standalone mode without the browser chrome.

> Push notifications require Home Screen installation on iPhone and configured VAPID keys in production.

### Manual notification test

1. Deploy over HTTPS or use localhost with VAPID keys configured.
2. Open **Settings → Notifications**.
3. Click **Enable notifications** (after granting permission).
4. Click **Send test notification**.

Scheduled daily/weekly notifications and automatic Canvas synchronization require Supabase Cron jobs described in [docs/integrations.md](docs/integrations.md) and [docs/deployment.md](docs/deployment.md).

## Current feature status

| Feature | Status |
|---------|--------|
| Next.js PWA shell | ✅ |
| Supabase authentication | ✅ |
| Email allowlist | ✅ |
| Database schema + RLS | ✅ Phase 2 |
| Manual events | ✅ Phase 2 |
| Manual tasks | ✅ Phase 2 |
| Availability rules | ✅ Phase 2 |
| Planning preferences | ✅ Phase 2 |
| Today / Week / Tasks / Settings UI | ✅ Phase 2 |
| Canvas ICS sync | ✅ Phase 3 |
| Automatic Canvas task sync | ✅ Phase 6.5 |
| Scheduled Canvas sync (6-hour cron) | ✅ Phase 6.6 |
| Workload engine | ✅ Phase 4 |
| Push notifications | ✅ Phase 5 |
| Planning proposals | ✅ Phase 6 |
| Deterministic chat assistant | ✅ Phase 7 |
| Microsoft 365 calendar (read-only) | ✅ Phase 8 (behind `MICROSOFT_INTEGRATION_ENABLED`, default off) |
| Workforce import | ⏳ Phase 9 |

## Project structure

```text
src/
├── app/
│   ├── (auth)/login/       # Login page
│   ├── (dashboard)/        # Protected pages
│   ├── api/                # API routes
│   ├── auth/callback/      # Auth callback
│   └── manifest.ts         # PWA manifest
├── components/             # UI components
├── lib/
│   ├── assistant/            # Deterministic command parser + executor (Phase 7)
│   ├── integrations/canvas/  # ICS fetch, parse, sync
│   ├── notifications/        # Web Push, scheduling, payloads (Phase 5)
│   ├── planning/             # Workload, proposals, allocation (Phase 4–6)
│   ├── data/                 # events, tasks, planning runs, workload
│   └── security/             # env validation, credential encryption
└── middleware.ts           # Route protection
```

## Development commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Run unit tests |
| `npm run generate-icons` | Regenerate PWA icons |

## Security notes

- Only `APP_ALLOWED_EMAIL` may access the dashboard.
- Server-only secrets must never use `NEXT_PUBLIC_` prefix.
- Service role key is used only for the protected cron notification endpoint.
- Public registration is not supported.

See [docs/security.md](docs/security.md) for the full security model and [docs/deployment.md](docs/deployment.md) for production operations.
