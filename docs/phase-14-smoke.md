# Phase 14 Smoke Checklist

Manual verification for loading polish, work profiles, search, PWA reliability, exports, and freeze readiness.

## Loading-state inventory (primary routes)

| Route | Initial | Slow panel | Mutation | Background | Empty | Recoverable error | Fatal |
|-------|---------|------------|----------|------------|-------|-------------------|-------|
| /today | TodaySkeleton | Suspense sections via independent try/catch | N/A | refresh | EmptyState | panel errors | error.tsx |
| /calendar | CalendarGridSkeleton | client loaders | drag/save pending | refetch | filter empty | RecoverableError | error.tsx |
| /tasks | TaskRowSkeleton | list | task actions | refresh | empty tasks | RecoverableError | error.tsx |
| /inbox | TaskRowSkeleton | list | triage pending | refresh | inbox clear | RecoverableError | error.tsx |
| /tasks/recurring | TaskRowSkeleton | list | template save | refresh | empty templates | RecoverableError | error.tsx |
| /chat | GenericPageSkeleton | chat load | send pending | N/A | assistant empty | RecoverableError | error.tsx |
| /work | WorkWeekSkeleton | editor | Review/Save pending | refresh | empty week | RecoverableError | error.tsx |
| /school | Settings cards | setup panels | save pending | refresh | no term | RecoverableError | error.tsx |
| /insights | InsightsSkeleton | charts | N/A | range change | empty metrics | RecoverableError | error.tsx |
| /review/daily | ReviewStepperSkeleton | step content | complete pending | N/A | clear | RecoverableError | error.tsx |
| /review/weekly | ReviewStepperSkeleton | step content | complete pending | N/A | clear | RecoverableError | error.tsx |
| /imports | Settings cards | integration cards | sync pending | N/A | not connected | RecoverableError | error.tsx |
| /settings | Settings cards | sections | save pending | refresh | N/A | RecoverableError | error.tsx |
| /status | Settings cards | Suspense panels | N/A | N/A | N/A | RecoverableError | error.tsx |

## Manual verification

1. Navigate every main route on desktop and iPhone — no unexplained blank screens.
2. Save settings and observe pending + success states.
3. Open a forced error path and confirm Retry + Back to Today.
4. Create three work profiles.
5. Add two different work shifts on one date; move one without affecting the other.
6. Verify work hours grouped by profile (including Unassigned work).
7. Open command palette (`Ctrl/Cmd+K`) and navigate by keyboard.
8. Search for a task, course, event, and work profile.
9. Deploy a new build and verify the PWA update prompt (Reload now / Later).
10. Begin a work draft, close the PWA, restore or discard.
11. Toggle offline and confirm mutation block + reconnect message.
12. Export ICS, tasks CSV, time CSV, work CSV, and JSON backup.
13. Inspect exports for secret leakage (no feed URLs, tokens, VAPID, push endpoints).
14. Run semester-readiness checklist on `/status`.
15. VoiceOver: loading status, search, calendar agenda, work editor.
16. Hit Canvas, notification, and recurring-task cron endpoints.
17. Verify Siri shortcut and AI fallback still privacy-bounded.
18. Confirm Microsoft integration remains disabled.
19. Complete `docs/production-freeze.md` checklist.

## Automated gate

```bash
npm run typecheck && npm run lint && npm test && npm run build
```
