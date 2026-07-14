# Phase 13.1 Smoke Checklist

Manual verification after Phase 13.1 hardening (recurrence lifecycle, review decisions, shelf, work shifts, notifications, diagnostics).

## Manual verification

1. Create a weekly recurring task.
2. Run generation twice.
3. Edit future recurrence.
4. Complete one occurrence.
5. Pause and resume the template.
6. Move and skip individual occurrences.
7. Test a task scheduled for the 31st across February.
8. Complete morning and evening reviews.
9. Change one deadline and keep another task overdue.
10. Defer a task without changing its due date.
11. Complete a weekly review.
12. Resolve a missed planning block.
13. Generate and accept a split rescheduling proposal.
14. Drag a partially planned task from the shelf.
15. Move a work shift across a week boundary.
16. Verify review and follow-up notifications.
17. Verify Canvas sync, timers, insights, AI chat, Siri, and PWA behavior.

## Diagnostics

```bash
curl -H "Cookie: <session>" https://<host>/api/diagnostics/phase13
```

Verify counts only (no titles, emails, or tokens):

- `activeTemplates`
- `templatesNeedingGeneration`
- `openReviewSessions`
- `completedReviewsToday`
- `tasksAwaitingDecisions`
- `blocksAwaitingFeedback`
- `deferredBecomingActionable`
- `waitingFollowupsDue`
- `notificationEligibility`

## Automated gate

```bash
npm run typecheck && npm run lint && npm test && npm run build
```
