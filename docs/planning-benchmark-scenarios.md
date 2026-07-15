# Planning Benchmark Scenarios

Command: `npm run test:planner`

Results artifact: `artifacts/planner-benchmark-results.json`

Harness: `tests/unit/planning/benchmarks/` — invokes production `generatePlanningProposals` with frozen clocks and `America/Chicago`.

## Scenario index

| ID | Name | Key expectation |
|----|------|-----------------|
| S01 | Simple task | 90 min, avoid lunch, before 5 PM |
| S02 | Narrow gaps | 120 min in valid ≥30 min gaps |
| S03 | Deadline vs priority | Today’s deadline wins over high priority |
| S04 | Urgent conflict | Honest shortfall ≥60 |
| S05 | Weekly overload | Cap at capacity; report shortfall |
| S06 | Existing accepted | Only remaining 60 proposed |
| S07 | Partial progress | Unscheduled = estimate − tracked − planned |
| S08 | Adaptive estimate | Plans 140 with provenance |
| S09 | Low samples | Factor not applied |
| S10 | No estimate | Diagnostics, not silent duration |
| S11 | Overdue | Eligible; overdue reason; may schedule after due |
| S12 | Waiting/deferred | Only actionable scheduled |
| S13 | Recurring | Template never scheduled |
| S14 | Required split | Three 60s |
| S15 | Avoid fragmentation | Prefer single 120 |
| S16 | Max focus | Blocks ≤90 |
| S17 | Breaks | ≥15 min between blocks |
| S18 | Class/work | Always blocking |
| S19 | Non-blocking | Does not carve capacity |
| S20 | All-day deadline | Marker does not block day |
| S21 | Cross-midnight | Local TZ correctness |
| S22a/b | DST spring/fall | Duration correctness |
| S23 | Week boundary | Requested week, not rolling 7 days |
| S24 | Daily priority | Ranking signal |
| S25 | Weekly priority | Ranking signal |
| S26 | Difficult-after | Prefer earlier slot |
| S27 | Determinism | 100 identical runs |
| S28 | Idempotent accept | No duplicate blocks |

## Assertion style

Expectations are **property-based** (totals, ordering constraints, capacity honesty), not exact clock slots when multiple valid slots exist.

## Score dimensions

Feasibility, deadline compliance, capacity honesty, priority rationality, estimate correctness, remaining-work correctness, fragmentation, preferences, history preservation, explanation accuracy, determinism, idempotency (0–2 each). Critical failures fail the run regardless of average.
