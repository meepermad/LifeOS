# Planning Defects

Baseline findings from architecture review and benchmark suite. Status reflects post-repair state where noted.

## Classification

| Area | Defect | Severity | Status |
|------|--------|----------|--------|
| Estimate calculation | Adaptive estimate ignored when `remaining_minutes` set equal to estimate | Critical | **Fixed** — adaptive applies when remaining === estimated |
| Remaining-work | Tracked minutes not subtracted from planner remaining | Critical | **Fixed** — subtracted when remaining still equals estimate |
| Remaining-work | `remaining-work.ts` mislabeled adaptive as `remaining_minutes` | Major | **Fixed** — uses pure breakdown fields |
| Task eligibility | Waiting / deferred / inbox not filtered in placer | Major | **Fixed** — `isPlannerEligibleTask` |
| Task ranking | Daily/weekly priorities unused by generator | Major | **Fixed** — flags on tasks + `compareTasks` |
| Deadline handling | Overdue tasks could not place after due date | Critical | **Fixed** — eligible days + placement past due |
| Splitting | Preferred 60 min caused unnecessary fragmentation | Major | **Fixed** — contiguous placement preference |
| Explanation | Missing deadline-urgency / priority reasons | Minor | **Fixed** — new reason codes |
| Input loading | Priorities not loaded into planning inputs | Major | **Fixed** — `loadPlanningInputs` |
| Validation | Travel buffer applied in generation but not accept TS path | Minor | Open (RPC overlap still hard-blocks) |
| Validation | In-progress focus counting differs (`endAt > now` vs `start_at >= now`) | Minor | Open |
| Availability | Per-rule preferred/max minutes unused | Minor | Open (document only) |
| Integrity | Proposal hash omits calibration factor | Minor | Open |

## Incorrect assumptions discovered

1. Stored `remaining_minutes` alone was treated as complete remaining work without tracked time.
2. Adaptive calibration was annotation-only whenever remaining mirrored the original estimate.
3. Shelf eligibility and placer eligibility used different workflow filters.
4. Overdue recovery required manual slot picking because due-date filtering excluded all days after the missed deadline.

## Repair order followed

1. Overlaps / zero duration — covered by invariants  
2. Remaining-work math  
3. Deadline / overdue placement  
4. Capacity honesty (benchmark + generator summary)  
5. Idempotent accept (existing RPC; S28)  
6. Adaptive estimates  
7. History preservation (accepted intervals)  
8. Prioritization + fragmentation  
9. Explanations  

## Open limitations

- Accept path does not re-apply travel buffers when validating overlaps in TypeScript (calendar still protected by RPC blocking check).
- Tracked minutes on live `loadPlanningInputs` are not yet bulk-hydrated from time entries (fixtures set `trackedMinutes` for benchmarks; UI breakdown path loads tracked separately).
- Real browser E2E for calendar accept is lightly covered via integration/entry-point tests, not full Playwright.
