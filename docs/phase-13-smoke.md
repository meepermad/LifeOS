# Phase 13 Smoke Checklist

Manual verification for recurring tasks, inbox, reviews, shelf, and Phase 13E notifications/assistant.

## Recurring tasks (13A)

1. Create a weekly recurring template at `/tasks/recurring/new`.
2. Confirm instances appear on Tasks with `recurrence_occurrence_key`.
3. Skip one occurrence; verify the task is cancelled and exception row exists.
4. Pause template; confirm no new instances after cron/manual materialize.
5. Trigger `POST /api/cron/recurring-tasks` with valid `CRON_SECRET`.

## Inbox and triage (13B)

1. Quick-capture a title-only task; confirm `inbox_at` is set.
2. Open `/inbox`; triage with due date, schedule, waiting, defer, archive.
3. Canvas sync-managed tasks never receive `inbox_at`.
4. Chat: `add "call advisor" to my inbox` → preview → confirm.

## Daily and weekly reviews (13C)

1. Start morning review at `/review/daily`; complete all steps.
2. Re-open same day; confirm completed session prevents duplicate completion.
3. Set daily priorities; verify Today shows up to three.
4. Complete weekly review at `/review/weekly`.

## Calendar shelf and rollover (13D)

1. Open `/calendar`; shelf lists actionable unscheduled tasks.
2. Drag task to grid → planning proposal preview (no direct event).
3. Evening review surfaces blocks awaiting feedback.
4. Chat: `preview rollover` shows per-task suggestions without bulk mutation.

## Notifications (13E)

1. Settings → Notifications: review/workflow toggles default **off**.
2. Enable morning review + set time; complete morning review; cron should skip reminder.
3. Incomplete morning review at scheduled time → one push per day (dedup).
4. Private mode: no task titles in push body.
5. Enable waiting follow-up; task with past `waiting_follow_up_at` triggers reminder.
6. Overdue decision and planning feedback reminders respect opt-in and counts only.

## Assistant and Siri

1. `show inbox` — count summary, no titles in private spoken mode.
2. `start morning review` — returns link to `/review/daily`.
3. `help plan today` — agenda + workload summary.
4. `show pending decisions` — overdue + inbox + feedback counts.
5. `defer <task> until tomorrow` — preview → confirm.
6. `create recurring task "water plants" every Monday` — preview → confirm.
7. Siri shortcut write command returns `review_required` with chat deep link.

## Navigation

1. More menu: Inbox, Daily Review, Weekly Review.
2. Desktop sidebar includes the same review entries.

## Automated gate

```bash
npm run typecheck && npm run lint && npm test && npm run build
```
