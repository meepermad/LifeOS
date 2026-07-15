export type PlannerPreferencesFixture = {
  minimumBreakMinutes?: number;
  travelBufferMinutes?: number;
  planningBufferPercent?: number;
  preferredFocusBlockMinutes?: number;
  maximumFocusBlockMinutes?: number;
  avoidDifficultWorkAfter?: string | null;
};

export type PlannerTaskFixture = {
  id: string;
  title?: string;
  status?: string;
  estimatedMinutes?: number | null;
  remainingMinutes?: number | null;
  trackedMinutes?: number;
  effectiveEstimateMinutes?: number | null;
  calibrationMeta?: { factor: number; sampleCount: number; reason: string };
  dueAt?: string | null;
  earliestStartAt?: string | null;
  priority?: number;
  difficulty?: number;
  splittable?: boolean;
  minimumBlockMinutes?: number;
  workflowState?: string | null;
  deferredUntilAt?: string | null;
  inboxAt?: string | null;
  parentTaskId?: string | null;
  isRecurrenceTemplate?: boolean;
  isDailyPriority?: boolean;
  isWeeklyPriority?: boolean;
  source?: string;
};

export type PlannerEventFixture = {
  id: string;
  title?: string;
  startAt: string;
  endAt: string;
  allDay?: boolean;
  status?: string;
  eventType?: string;
  blocksTime?: boolean;
  source?: string;
  relatedTaskId?: string | null;
};

export type PlannerBlockFixture = {
  taskId: string;
  startAt: string;
  endAt: string;
  accepted?: boolean;
};

export type PlannerExpectation = {
  mustSchedule?: string[];
  mustNotSchedule?: string[];
  totalMinutesByTask?: Record<string, number>;
  latestEndByTask?: Record<string, string>;
  maximumBlockCountByTask?: Record<string, number>;
  minimumBlockMinutes?: number;
  mustReportInsufficientCapacity?: boolean;
  minimumUnscheduledMinutes?: number;
  maximumUnscheduledMinutes?: number;
  mustMentionReasons?: string[];
  exactBlockCount?: number;
  exactBlockCountByTask?: Record<string, number>;
  noOverlapEventIds?: string[];
  diagnosticsMustIncludeTaskIds?: string[];
  requireDeterministic?: boolean;
  requireIdempotentAccept?: boolean;
  customChecks?: string[];
  allowFailure?: boolean;
};

export type PlannerScenario = {
  id: string;
  name: string;
  now: string;
  timezone: string;
  rangeStart: string;
  rangeEnd: string;
  dayKeys: string[];
  periodType: "day" | "week";
  weekStartsOn?: 0 | 1;
  preferences: PlannerPreferencesFixture;
  availabilityRules: Array<{
    dayOfWeek: number;
    availableStart: string;
    availableEnd: string;
    isEnabled?: boolean;
  }>;
  tasks: PlannerTaskFixture[];
  fixedEvents: PlannerEventFixture[];
  existingPlanningBlocks?: PlannerBlockFixture[];
  expected: PlannerExpectation;
  scoreDimensions?: string[];
};

export type ExpectationFailure = {
  check: string;
  message: string;
};

export type ScenarioRunResult = {
  scenarioId: string;
  scenarioName: string;
  passed: boolean;
  criticalFailures: string[];
  expectationFailures: ExpectationFailure[];
  invariantReport: {
    passCount: number;
    failCount: number;
    passRate: number;
    criticalFailureMessages: string[];
  };
  scorecard: Record<string, number>;
  scoreTotal: number;
  scoreMax: number;
  summary: {
    proposalCount: number;
    totalProposedMinutes: number;
    unscheduledMinutes: number;
    atRiskTaskIds: string[];
    unschedulableTaskIds: string[];
  };
};

export type BenchmarkResults = {
  runAt: string;
  scenarioCount: number;
  passedCount: number;
  failedCount: number;
  results: ScenarioRunResult[];
};
