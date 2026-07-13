import type { EventStatus, EventType, TaskStatus } from "@/types/domain";
import type { WorkloadStatus } from "@/types/domain";

export type TimeInterval = {
  startMs: number;
  endMs: number;
};

export const BLOCKING_EVENT_TYPES: readonly EventType[] = [
  "class",
  "work",
  "meeting",
  "appointment",
  "focus_block",
  "travel",
  "personal",
  "meal",
  "exercise",
] as const;

export const TRAVEL_BUFFER_EVENT_TYPES: readonly EventType[] = [
  "class",
  "work",
  "meeting",
  "appointment",
] as const;

export const ACTIVE_TASK_STATUSES: readonly TaskStatus[] = [
  "open",
  "in_progress",
  "deferred",
] as const;

export type PlanningEvent = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  status: EventStatus;
  eventType: EventType;
  blocksTime: boolean;
  source: string;
  relatedTaskId: string | null;
};

export type PlanningTask = {
  id: string;
  title: string;
  status: TaskStatus;
  dueAt: string | null;
  earliestStartAt: string | null;
  estimatedMinutes: number | null;
  remainingMinutes: number | null;
  effectiveEstimateMinutes?: number | null;
  calibrationMeta?: {
    factor: number;
    sampleCount: number;
    reason: string;
    groupKey?: string;
    groupLabel?: string;
  };
  priority: number;
  difficulty: number;
  splittable: boolean;
  minimumBlockMinutes: number;
  source: string;
  relatedEventId: string | null;
};

export type PlanningAvailabilityRule = {
  dayOfWeek: number;
  availableStart: string;
  availableEnd: string;
  isEnabled: boolean;
};

export type PlanningPreferences = {
  minimumBreakMinutes: number;
  travelBufferMinutes: number;
  planningBufferPercent: number;
  preferredFocusBlockMinutes: number;
  maximumFocusBlockMinutes: number;
  avoidDifficultWorkAfter: string | null;
};

export type PendingProposalInterval = {
  taskId: string;
  startAt: string;
  endAt: string;
};

export type ProposalExplanation = {
  reason: string;
  dueAt: string | null;
  availableIntervalMinutes: number;
  taskRemainingMinutes: number;
  scheduledTaskMinutesBeforeProposal: number;
  preferenceMatches: string[];
  preferenceViolations: string[];
  calibration?: {
    userEstimate: number;
    effectiveEstimate: number;
    factor: number;
    sampleCount: number;
    reason: string;
  };
};

export type FocusBlockProposal = {
  taskId: string;
  taskTitle: string;
  proposedStartAt: string;
  proposedEndAt: string;
  proposedMinutes: number;
  explanation: ProposalExplanation;
  proposalHash: string;
};

export type UnschedulableTask = {
  taskId: string;
  taskTitle: string;
  unscheduledRemainingMinutes: number;
  reason: string;
};

export type PlanningRunSummary = {
  totalProposedMinutes: number;
  fullyScheduledTaskIds: string[];
  partiallyScheduledTaskIds: string[];
  unscheduledMinutes: number;
  unschedulableTasks: UnschedulableTask[];
  warnings: string[];
  atRiskTaskIds: string[];
};

export type PlanningGenerationResult = PlanningRunSummary & {
  proposals: FocusBlockProposal[];
};

export type PlanningProposalInput = {
  events: PlanningEvent[];
  tasks: PlanningTask[];
  availabilityRules: PlanningAvailabilityRule[];
  preferences: PlanningPreferences;
  weekStartsOn: 0 | 1;
  now: Date;
  periodType: "day" | "week";
  periodStart: Date;
  periodEnd: Date;
  dayKeys: string[];
  pendingProposalIntervals: PendingProposalInterval[];
  acceptedProposalIntervals: PendingProposalInterval[];
};

export type OpenIntervalsForDay = {
  dateKey: string;
  openIntervals: TimeInterval[];
  availableFocusMinutes: number;
  scheduledFocusMinutes: number;
  needsAvailabilityConfiguration: boolean;
  remainingProposalBudgetMinutes: number;
};

export type ProposalValidationContext = {
  proposal: {
    id: string;
    taskId: string;
    proposedStartAt: string;
    proposedEndAt: string;
    proposedMinutes: number;
    proposalHash: string;
    status: string;
    planningRunId: string;
  };
  run: {
    id: string;
    status: string;
  };
  task: PlanningTask | null;
  events: PlanningEvent[];
  preferences: PlanningPreferences;
  calendarWritable: boolean;
  userId: string;
  ownerUserId: string;
};

export type DayCapacity = {
  dateKey: string;
  availabilityMinutes: number;
  fixedMinutes: number;
  rawOpenMinutes: number;
  reservedBufferMinutes: number;
  availableFocusMinutes: number;
  scheduledFocusMinutes: number;
  needsAvailabilityConfiguration: boolean;
};

export type TaskSortComponents = {
  isOverdue: boolean;
  dueAt: string | null;
  priority: number;
  difficulty: number;
  workloadMinutes: number;
};

export type TaskAllocationEntry = {
  taskId: string;
  title: string;
  allocatedMinutes: number;
  unallocatedMinutes: number;
  sortComponents: TaskSortComponents;
  isAtRisk: boolean;
  isImpossibleBeforeDeadline: boolean;
};

export type DayAllocation = {
  dateKey: string;
  allocatedMinutes: number;
  taskEntries: { taskId: string; minutes: number }[];
};

export type AllocationResult = {
  perDayAllocations: DayAllocation[];
  allocatedTaskMinutes: number;
  unallocatedTaskMinutes: number;
  tasksAtRisk: string[];
  tasksImpossibleBeforeDeadline: string[];
  taskEntries: TaskAllocationEntry[];
};

export type DayWorkloadSummary = DayCapacity & {
  recommendedTaskMinutes: number;
  requiredTaskMinutes: number;
  capacityRatio: number | null;
  status: WorkloadStatus;
  hasIncompleteData: boolean;
};

export type WorkloadSummary = {
  periodType: "day" | "week";
  periodStart: string;
  periodEnd: string;
  fixedMinutes: number;
  rawOpenMinutes: number;
  reservedBufferMinutes: number;
  availableFocusMinutes: number;
  requiredTaskMinutes: number;
  allocatedTaskMinutes: number;
  unallocatedTaskMinutes: number;
  scheduledFocusMinutes: number;
  unestimatedTaskCount: number;
  overdueTaskCount: number;
  capacityRatio: number | null;
  status: WorkloadStatus;
  hasIncompleteData: boolean;
  needsAvailabilityConfiguration: boolean;
  daySummaries: DayWorkloadSummary[];
  allocation: AllocationResult;
  tentativeEventIds: string[];
  unestimatedTaskIds: string[];
  highestPressureDays: string[];
  explanation: string[];
};

export type WorkloadPeriodType = "day" | "week";

export type WorkloadInputs = {
  events: PlanningEvent[];
  tasks: PlanningTask[];
  availabilityRules: PlanningAvailabilityRule[];
  preferences: PlanningPreferences;
  weekStartsOn: 0 | 1;
  now: Date;
  periodType: "day" | "week";
  periodStart: Date;
  periodEnd: Date;
  dayKeys: string[];
};

export const WORKLOAD_STATUS_THRESHOLDS = {
  manageableMax: 0.65,
  heavyMax: 0.9,
} as const;
