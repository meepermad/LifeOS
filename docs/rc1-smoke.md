# LifeOS RC1 smoke checklist

Release gate:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

No new migrations are expected for RC1.

## Shell

- [ ] Header shows LifeOS brand link to Today, Search, and account menu (no primary Sign Out)
- [ ] Account menu: profile, system status, version, sign out
- [ ] Desktop sidebar icons + mobile bottom nav icons
- [ ] Ctrl/⌘K opens command palette; mobile Search opens sheet

## Settings IA

- [ ] `/settings` hub lists eight sections
- [ ] Each `/settings/[section]` loads independently with ← Settings back link
- [ ] Legacy `/settings?section=notifications` redirects to `/settings/notifications`
- [ ] Push test notification opens notification settings

## Search / commands

- [ ] Search returns tasks, events, work shifts, courses, terms, templates, notifications, settings pages
- [ ] Commands: Today, Calendar, Inbox, Create task/event, Exports, Status, Start/Stop timer

## Today

- [ ] Events, work shifts, due tasks, deadlines, timer, hours remaining, reminders, workload, recent activity, pending reviews
- [ ] Inbox attention tile links to `/inbox`
- [ ] Section errors show Retry / Refresh

## Readiness

- [ ] Status page diagnostics use ✅/❌/⚠ with why / how / time / deep links
- [ ] Recurrence check reflects templates past end date (not stubbed always-ok)

## Surfaces

- [ ] Export center shows generating/download status
- [ ] Siri settings validate API URL and device name
- [ ] AI Advanced hides unavailable provider details when disabled
- [ ] Calendar drag/hover/deadline visuals
- [ ] Insights at-a-glance summary + confidence notes
- [ ] Review keyboard ←/→ or k/j

## Platform

- [ ] Mobile: safe areas, no horizontal scroll, 44px targets
- [ ] Desktop: cards not stretched on ultrawide
- [ ] PWA / offline / push / Canvas sync / work import (manual device checks)

## Known deferred

- In-app “Report issue”
- Backup restore
- Rich BI analytics beyond Insights summaries
