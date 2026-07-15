# Planning Engine Audit

Timezone baseline: **America/Chicago** (`APP_TIMEZONE`).

## Call graph (request → persisted blocks)

```text
UI / Assistant / Review / Task shelf
  → loadPlanningInputs (period, events, tasks, availability, prefs, calibration, priorities)
  → generatePlanningProposals (pure placer)
  → persist planning_runs + planning_proposals (pending)
  → validateProposalForAcceptance (+ SQL accept_planning_proposal)
  → focus_block event on LifeOS Planning calendar
```

## Major functions

### `loadPlanningInputs` (`src/lib/data/planning.ts`)

| | |
|--|--|
| **Inputs** | `periodType` day\|week, optional `weekOffset` |
| **Outputs** | `PlanningProposalInput` |
| **Assumptions** | Active tasks only; profile week start; app timezone |
| **Filtering** | Merges academic blockers; attaches calibration + daily/weekly priority flags |
| **Timezone** | Day/week bounds via `getTodayBoundsUtc` / `getWeekBounds` |
| **Ordering** | Tasks later sorted by placer |
| **Failure** | Propagates DB / auth errors |

### `generatePlanningProposals` (`src/lib/planning/proposal-generator.ts`)

| | |
|--|--|
| **Inputs** | Full `PlanningProposalInput` |
| **Outputs** | Proposals + capacity summary |
| **Assumptions** | Deterministic; no I/O |
| **Filtering** | Eligible workflow; estimates required; unscheduled remaining > 0 |
| **Ordering** | `compareTasks`: overdue → earlier due → daily/weekly priority → priority # → difficulty → workload → id |
| **Failure** | Unschedulable tasks + warnings; never throws on capacity shortfall |

### Open intervals (`availability` → `fixed-commitments` → `open-intervals`)

Decides available intervals: weekday rules − blocking events (incl. travel buffer) − pending/accepted proposals − planning buffer %.

### Remaining work (`remaining-work-math.ts`)

| Decision | Rule |
|----------|------|
| Planning estimate | Adaptive when `remaining === estimated`; else remaining; else estimate |
| Tracked time | Subtracted when remaining still equals original estimate |
| Unscheduled | Remaining − future confirmed focus (− pending in some paths) |

### Task eligibility (`isPlannerEligibleTask`)

Excludes: inactive/completed/cancelled, inbox, waiting/someday/backlog, deferred-until future, recurrence templates/children.

### Adaptive estimates (`analytics/calibration.ts` + `planning-calibration.ts`)

Applied when adaptive enabled, sample count ≥ 5, factor clamped 0.75–1.75. Provenance on proposal explanation. Original `estimated_minutes` unchanged.

### Placement (`focus-blocks.ts`)

Chooses block size (min/preferred/max), prefers contiguous fit when an interval can hold remaining (≤ max), respects breaks and difficult-work cutoff, allows overdue placement past due.

### Validation (`proposal-validation.ts` + RPC)

Ownership, pending status, hash/workload match, no blocking overlap, deadline (unless already overdue), calendar writable. RPC is idempotent on re-accept.

## Where LifeOS decides

| Question | Location |
|----------|----------|
| Actionable task? | `isPlannerEligibleTask` / triage |
| Remaining work? | `getRemainingWorkMinutes` |
| Which estimate? | Adaptive vs remaining precedence |
| Task selection? | `getRelevantTasksForPeriod` |
| Ranking? | `compareTasks` |
| Available intervals? | `computeOpenIntervalsForDay` |
| May split? | `task.splittable` + multi-day loop |
| Min useful block? | `task.minimumBlockMinutes` + prefer/max prefs |
| Deadline still met? | `latestEndMs` + eligible days; overdue marked separately |
| Insufficient capacity? | `unscheduledMinutes`, `atRiskTaskIds`, `unschedulableTasks` |
| Preserve accepted blocks? | Treated as pending/accepted intervals carving open time |
| Reject proposal? | `validateProposalForAcceptance` / RPC |

## Planner invariants

See `src/lib/planning/invariants.ts` — feasibility, task-allocation, integrity, capacity, explanation assertions evaluated on every benchmark run.

## Ranking model (deterministic)

1. Overdue first  
2. Earlier hard deadline (deadline urgency beats priority number)  
3. Daily priority, then weekly priority  
4. Lower priority number (1 = highest)  
5. Higher difficulty  
6. Larger remaining workload  
7. Stable task id  

No opaque AI ranking.
