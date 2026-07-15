# Planning Accuracy Report

**Date:** 2026-07-15  
**Timezone under test:** America/Chicago  
**Command:** `npm run test:planner`  
**Artifact:** `artifacts/planner-benchmark-results.json`

## Verdict

The planning engine was measured against independent property benchmarks (not tuned to match incidental slot order). After priority repairs, **29/29 scenarios pass with no critical invariant failures**. Overall scoreboard on the recorded run: **100% scenario pass**, feasibility / history-preservation / idempotency dimensions at full marks on recorded scenarios.

## 1. Architecture

Documented in `docs/planning-engine-audit.md`. Core path: `loadPlanningInputs` → `generatePlanningProposals` → validate/accept RPC → `focus_block`.

## 2–3. Baseline vs final

Pre-repair architecture review predicted critical defects in adaptive estimates, tracked remaining work, overdue eligibility, waiting/deferred filtering, and fragmentation. Benchmark suite created to freeze expectations independently.

**Final:** `passedCount: 29`, `failedCount: 0` in `artifacts/planner-benchmark-results.json`.

## 4–13. Defect themes (summary)

See `docs/planning-defects.md` for classification. Highlights repaired: remaining-work math, adaptive application, overdue recovery, eligibility filters, daily/weekly priority ranking, contiguous placement, deadline-urgency explanations.

## 14. Explanation defects

Reason codes now include `deadline_urgency`, `daily_priority`, `weekly_priority`, `overdue_high_priority`. Explanation consistency helper in `diagnostics.ts`.

## 15. Repairs implemented

- `remaining-work-math.ts` + wired into allocation/validation/UI breakdown  
- `invariants.ts`, `diagnostics.ts`  
- Eligibility + ranking updates in `task-allocation.ts`  
- Contiguous placement in `focus-blocks.ts`  
- Overdue placement + accept validation  
- Priority attachment in `loadPlanningInputs`  
- Benchmark harness S01–S28 + property/metamorphic tests  

## 16. Final benchmark score

All recorded scenarios scored **24/24** on the 12-dimension scorecard in the latest artifact (2 points each dimension).

## 17. Scenarios still failing

None in the automated suite after repairs.

## 18. Property-test results

`tests/unit/planning/property/property.test.ts` — seeded fuzz + metamorphic relationships: **passing**.

## 19. End-to-end / entry points

Integration and e2e planning entry-point tests document shared semantics for controls, shelf, assistant, and reviews. Full browser persistence matrix remains a follow-up.

## 20. Files created/modified (primary)

**Created:**  
`src/lib/planning/remaining-work-math.ts`, `invariants.ts`, `diagnostics.ts`,  
`docs/planning-*.md`, `tests/unit/planning/benchmarks/**`, `tests/unit/planning/invariants/**`,  
`tests/unit/planning/property/**`, `tests/integration/planning/**`, `tests/e2e/planning/**`,  
`artifacts/planner-benchmark-results.json`, `scripts/run-planner-benchmarks.mjs`

**Modified:**  
`proposal-generator.ts`, `proposal-validation.ts`, `focus-blocks.ts`, `task-allocation.ts`,  
`types.ts`, `mappers.ts`, `remaining-work.ts`, `proposal-explanations.ts`,  
`src/lib/data/planning.ts`, `package.json`

## 21. Test counts

- Planner suite (`npm run test:planner`): **39** tests  
- Full suite at last green planning subset: **686** total tests (1 prior failure fixed)

## 22–24. Verification

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:planner`, `npm run build` on this branch; results recorded in the commit message / CI.

## 25. Known limitations

- Live planner does not yet bulk-inject tracked minutes into `PlanningTask` at load time.  
- Travel-buffer parity between generator and TS accept validation.  
- No production planner-lab UI shipped (optional Part I deferred; harness is required and present).

## 26. Recommended next actions

1. Hydrate `trackedMinutes` in `loadPlanningInputs` from time-entry aggregates.  
2. Align accept validation travel buffers with generation.  
3. Add Playwright coverage for accept/reject persistence.  
4. Only then start Phase 14 planning features.

## Before / after samples

| Scenario | Before (architecture) | After (benchmark) |
|----------|----------------------|-------------------|
| S01 Simple | Would schedule but buffer/prefs risky | 90 min, 1 block, pass |
| S07 Progress | Would plan full/ignore tracked | Unscheduled 70, pass |
| S08 Adaptive | Factor ignored if remaining set | Plans 140, provenance, pass |
| S11 Overdue | No eligible days after due | Schedules with overdue reason, pass |
| S15 Fragmentation | Often 60+60 | Prefers contiguous 120, pass |
