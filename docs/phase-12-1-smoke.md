# Phase 12.1 Smoke Checklist

Manual verification before relying on calibration history.

## Completion review

1. Open Tasks and click **Complete** on a task with tracked time.
2. Confirm the completion review dialog shows estimate, tracked time, and proposed actual.
3. Complete with tracked time; verify task shows `actual_minutes` and a snapshot exists.
4. Reopen the task; verify `actual_minutes` clears and prior snapshot is superseded.
5. Re-complete; verify a new snapshot row with incremented `completion_sequence`.

## Stale timer

1. Start a timer and (for testing) lower `stale_timer_threshold_hours` in planning preferences.
2. Confirm in-app stale banner appears on dashboard layout.
3. Use **Still working**, **Stop now**, **Choose end time**, and **Discard** paths.
4. Trigger notification cron; verify at most one stale push per timer episode.

## Calendar mutations

1. Drag a manual event — should save.
2. Drag a Canvas/academic/deadline event — should revert with workflow link.
3. Drag a planning focus block — should move via planning workflow.
4. Toggle **Show completed planning blocks** filter.

## Calibration

1. Complete 5+ tasks in the same course/category with estimates.
2. Regenerate planning; open proposal card and confirm calibration line.
3. Set planning estimate override to **original** on a task; confirm adaptive is skipped.

## Diagnostics

```bash
curl -H "Cookie: <session>" https://<host>/api/diagnostics/timing
```

Verify counts only (no private titles when privacy mode is on).

## Automated gate

```bash
npm run typecheck && npm run lint && npm test && npm run build
```
