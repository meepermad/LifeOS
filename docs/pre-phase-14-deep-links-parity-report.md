# Pre-Phase 14 Completion Report: Notification Deep Links and Planner Parity

Do not begin Phase 14 from this report alone; product Phase 14 remains gated separately.

## 1. Existing notification-click behavior

Before this work, push payloads carried only `{ title, body, tag, url }`. The service worker stripped query strings and omitted `/review/*` from its allowlist, so review notifications effectively opened `/today`. Window reuse existed (`matchAll` → `navigate` → `focus`), but destinations were wrong. Entity IDs were never in the push JSON.

## 2. Destination contract

Typed `NotificationDestination` union and `LifeOsPushData` (`version: 1`, `notificationType`, `destination`, optional `deliveryId`) live in [`src/lib/notifications/destination.ts`](src/lib/notifications/destination.ts), mirrored by [`public/lifeos-notification-destinations.js`](public/lifeos-notification-destinations.js) for the service worker.

## 3. Notification-type mapping

| Type | Destination path |
|------|------------------|
| `daily_agenda` | `/today` |
| `weekly_summary` | `/calendar?view=week` |
| `morning_review` / `evening_review` | `/review/daily?period=…` |
| `weekly_review` | `/review/weekly` |
| `deadline_warning` | `/tasks?view=upcoming|overdue&focus=…` (list-level if multi) |
| `waiting_followup` | `/tasks?view=waiting&focus=<taskId>` |
| `overdue_decision` | `/tasks?view=overdue&focus=…` |
| `planning_feedback` | `/review/daily?period=evening&step=planning-feedback&focus=…` |
| `stale_timer` | `/today?panel=active-timer` |
| `overload_warning` | `/review/weekly?step=capacity` (aliases to planning step) |
| `test` | `/settings?section=notifications` |

## 4. Service-worker navigation implementation

[`public/sw.js`](public/sw.js) imports the destination mirror, resolves v1 `destination` or legacy `url`, closes the notification, prefers same-origin clients (`navigate` + `focus`), posts `LIFEOS_NOTIFICATION_NAVIGATE` on navigate failure, and falls back to `openWindow`.

## 5. Existing-window reuse

Visible/focused same-origin clients are preferred; uncontrolled clients included. Other-origin clients are ignored.

## 6. Closed-app behavior

When no client exists, `clients.openWindow(absoluteUrl)` opens the resolved internal path.

## 7. Logged-out behavior

Middleware preserves pathname + search in `next`, protects `/review`, `/inbox`, `/status`, and uses `sanitizeInternalReturnPath`. Login and auth callback validate return paths the same way. Logged-in visits to `/login?next=…` redirect to the sanitized destination.

## 8. Task-focused navigation

`/tasks` accepts `view` (maps to filters) and `focus`. Ownership is re-checked via `getTaskById`. Missing tasks show “This item is no longer available.” State mismatch opens the task in its current valid context.

## 9. Review-focused navigation

Daily review honors `period`, `step`, and `focus`. `planning-feedback` aliases to evening `feedback`. Weekly `step=capacity` maps to the existing `planning` step.

## 10. Planning-feedback navigation

Evening feedback step focuses the matching block card when present; otherwise shows a safe resolved/unavailable message and the unresolved list.

## 11. Timer navigation

`/today?panel=active-timer` highlights the persistent timer bar or shows “No active timer right now.” Navigation does not mutate timers.

## 12. Legacy-payload handling

Legacy `{ url }` payloads still resolve: `/settings` and `/test` → notification settings; unknown/malformed → `/today`. Dual-write includes both `destination` and resolved `url`.

## 13. Security validation

`sanitizeInternalReturnPath` rejects external URLs, `//`, protocols, backslashes, control characters, oversized paths, and unknown prefixes. Invalid UUIDs/periods/dates fall back to `/today`. Covered by destination security tests.

## 14. PWA update requirements

Shell cache bumped to `lifeos-shell-v3`. Existing `OperationalProvider` update banner remains; no aggressive unconditional `skipWaiting()`. After deploy, use in-app “Reload now”; if dismissed, close and reopen the PWA so the new worker activates.

## 15. Notification tests

Added: destination unit + SW parity, security matrix, service-worker click mocks, deep-link helpers, updated payloads/privacy tests.

## 16. Tracked-time live-loader defect

`loadPlanningInputs` previously left `trackedMinutes` undefined, so production over-scheduled vs benchmarks (Scenario 7).

## 17. Tracked-time hydration repair

`sumTrackedSecondsByTaskIds` bulk-loads Phase 12.1 reviewed entries. `loadPlanningInputs` and `getTaskFocusScheduleSummaries` attach `trackedMinutes`. Accept validation also hydrates tracked minutes for the linked task.

## 18. Production-loader parity test

[`tests/unit/planning/production-tracked-hydration.test.ts`](tests/unit/planning/production-tracked-hydration.test.ts): 180 − 70 − 40 → proposes **70** (fails if 180 or 110).

## 19. Travel-buffer generation behavior

Unchanged policy: generation expands travel-sensitive blocking events via shared helpers now in [`blocking-overlap.ts`](src/lib/planning/blocking-overlap.ts) / [`fixed-commitments.ts`](src/lib/planning/fixed-commitments.ts).

## 20. Travel-buffer acceptance behavior

Acceptance uses the same `findBlockingConflict` with preferences.travelBufferMinutes. Event fetch widens by ± buffer around the proposal.

## 21. Shared validation service

[`src/lib/planning/blocking-overlap.ts`](src/lib/planning/blocking-overlap.ts) is the shared conflict-policy service for generation and TS acceptance. RPC raw-overlap remains a hard floor (no SQL buffer rewrite).

## 22. Planner benchmark results

`npm run test:planner`: **39/39** passed (29 scenarios + invariants/property/integration).

## 23. Files modified (primary)

- `src/lib/notifications/destination.ts` (new)
- `public/lifeos-notification-destinations.js` (new)
- `public/sw.js`
- `src/lib/notifications/payloads.ts`, `schemas.ts`, `privacy.ts`, `scheduling.ts`, `workflow-queries.ts`
- Review/tasks/today/settings pages + steppers; middleware; auth login/callback
- `src/lib/data/time-entries.ts`, `src/lib/data/planning.ts`
- `src/lib/planning/blocking-overlap.ts` (new), `fixed-commitments.ts`, `proposal-validation.ts`
- `src/lib/actions/planning.ts`
- Tests under `tests/unit/notifications/*`, `tests/unit/planning/*`

## 24. Migration filename

None. No `opened_at` tracking migration.

## 25. Test counts

- Full suite: **726** passed (150 files)
- Planner suite: **39** passed
- Typecheck: pass
- Lint: pass (pre-existing warnings only)
- Build: pass

## 26. Typecheck result

`npm run typecheck` — success.

## 27. Lint result

`npm run lint` — success (0 errors; existing warnings elsewhere).

## 28. Build result

`npm run build` — success.

## 29. Deployment steps

1. Deploy app (includes new `sw.js` + `lifeos-notification-destinations.js`).
2. Open LifeOS; accept “Reload now” when the SW update banner appears (or reopen PWA).
3. Send a test notification from Settings and confirm click opens notification settings.
4. Spot-check review and task deep links from cron-generated notifications after the next schedule window.

## 30. Manual iPhone test results

Not executed in this environment. Use the Part J click matrix on the installed PWA after deploy.

## 31. Known limitations

- RPC `accept_planning_proposal` still uses raw overlap only; buffer-zone conflicts rely on TS pre-accept validation.
- Aggregate deadline/overdue/feedback notifications stay list-level when multiple entities are due.
- Direct `WindowClient.navigate` may still fail on some browsers; message + `openWindow` fallbacks cover that.
- Manual iPhone verification remains required for production confidence.
- Phase 14 not started.
