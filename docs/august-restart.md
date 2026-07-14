# August Restart Checklist

Use this when returning from the production freeze to prepare a new academic period. Do not hardcode a specific semester; apply the current academic preset in School setup.

1. Apply any pending Supabase migrations (`npx supabase db push`).
2. Verify the latest Vercel production deployment is healthy.
3. Confirm all cron jobs are succeeding (Canvas, recurring tasks, notifications).
4. Reconnect or verify Canvas on `/imports` and confirm last success on `/status`.
5. Apply the current academic preset in School setup.
6. Add courses and class meetings; materialize meetings.
7. Review duplicate Canvas class candidates.
8. Enter work profiles and upcoming shifts on `/work`.
9. Verify push notifications on the installed PWA.
10. Run morning and weekly reviews.
11. Inspect stale timers on `/status` and Today.
12. Review adaptive-planning samples for the new term week.
13. Export a full JSON backup from Settings → Export center.
14. Optionally pin or open semester readiness on `/status` until checks are green.

Automated gate after any restart change:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```
