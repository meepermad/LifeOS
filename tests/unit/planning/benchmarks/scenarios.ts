import {
  addAppDays,
  toUtcEndOfAppLocalDay,
  toUtcFromAppLocalDate,
} from "@/lib/dates/timezone";
import { chicago } from "./build-input";
import type {
  PlannerEventFixture,
  PlannerScenario,
  PlannerTaskFixture,
} from "./types";

const MON = "2026-08-24";
const TZ = "America/Chicago";

function dayRange(dateKey: string): { rangeStart: string; rangeEnd: string } {
  return {
    rangeStart: toUtcFromAppLocalDate(dateKey).toISOString(),
    rangeEnd: toUtcEndOfAppLocalDay(dateKey).toISOString(),
  };
}

function weekFromMonday(mondayKey: string): {
  dayKeys: string[];
  rangeStart: string;
  rangeEnd: string;
} {
  const dayKeys = Array.from({ length: 7 }, (_, index) =>
    addAppDays(mondayKey, index),
  );
  return {
    dayKeys,
    rangeStart: toUtcFromAppLocalDate(dayKeys[0]).toISOString(),
    rangeEnd: toUtcEndOfAppLocalDay(dayKeys[6]).toISOString(),
  };
}

function dowAvailability(
  dayOfWeek: number,
  start: string,
  end: string,
): PlannerScenario["availabilityRules"][number] {
  return {
    dayOfWeek,
    availableStart: start,
    availableEnd: end,
    isEnabled: true,
  };
}

function allWeekdays(
  start: string,
  end: string,
): PlannerScenario["availabilityRules"] {
  return [1, 2, 3, 4, 5].map((dow) => dowAvailability(dow, start, end));
}

function task(
  id: string,
  overrides: Partial<PlannerTaskFixture> = {},
): PlannerTaskFixture {
  return { id, ...overrides };
}

function event(
  id: string,
  dateKey: string,
  startTime: string,
  endTime: string,
  overrides: Partial<PlannerEventFixture> = {},
): PlannerEventFixture {
  return {
    id,
    startAt: chicago(dateKey, startTime),
    endAt: chicago(dateKey, endTime),
    ...overrides,
  };
}

const S01: PlannerScenario = {
  id: "S01",
  name: "Simple task — reflection before deadline",
  now: chicago(MON, "09:00:00"),
  timezone: TZ,
  ...dayRange(MON),
  dayKeys: [MON],
  periodType: "day",
  weekStartsOn: 1,
  preferences: {},
  availabilityRules: [dowAvailability(1, "09:00:00", "17:00:00")],
  fixedEvents: [
    event("lunch", MON, "12:00:00", "13:00:00", {
      title: "Lunch",
      eventType: "meal",
      blocksTime: true,
    }),
  ],
  tasks: [
    task("task-reflection", {
      title: "Write reflection",
      estimatedMinutes: 90,
      remainingMinutes: 90,
      dueAt: chicago(MON, "17:00:00"),
      splittable: false,
      minimumBlockMinutes: 30,
    }),
  ],
  expected: {
    mustSchedule: ["task-reflection"],
    totalMinutesByTask: { "task-reflection": 90 },
    latestEndByTask: { "task-reflection": chicago(MON, "17:00:00") },
    maximumBlockCountByTask: { "task-reflection": 1 },
    maximumUnscheduledMinutes: 0,
    noOverlapEventIds: ["lunch"],
  },
};

const S02: PlannerScenario = {
  id: "S02",
  name: "Narrow gaps between fixed events",
  now: chicago(MON, "08:00:00"),
  timezone: TZ,
  ...dayRange(MON),
  dayKeys: [MON],
  periodType: "day",
  weekStartsOn: 1,
  preferences: {
    minimumBreakMinutes: 15,
    preferredFocusBlockMinutes: 60,
    maximumFocusBlockMinutes: 120,
  },
  availabilityRules: [dowAvailability(1, "08:00:00", "22:00:00")],
  fixedEvents: [
    event("class-1", MON, "09:00:00", "10:15:00", {
      title: "Class A",
      eventType: "class",
    }),
    event("class-2", MON, "11:30:00", "12:45:00", {
      title: "Class B",
      eventType: "class",
    }),
    event("work", MON, "14:00:00", "18:00:00", {
      title: "Work shift",
      eventType: "work",
    }),
  ],
  tasks: [
    task("task-gap", {
      title: "Gap filler assignment",
      estimatedMinutes: 120,
      remainingMinutes: 120,
      dueAt: chicago(MON, "22:00:00"),
      minimumBlockMinutes: 30,
      splittable: true,
    }),
  ],
  expected: {
    mustSchedule: ["task-gap"],
    totalMinutesByTask: { "task-gap": 120 },
    minimumBlockMinutes: 30,
    noOverlapEventIds: ["class-1", "class-2", "work"],
  },
};

const S03: PlannerScenario = {
  id: "S03",
  name: "Deadline beats priority when capacity is tight",
  now: chicago(MON, "09:00:00"),
  timezone: TZ,
  ...dayRange(MON),
  dayKeys: [MON],
  periodType: "day",
  weekStartsOn: 1,
  preferences: {},
  availabilityRules: [dowAvailability(1, "09:00:00", "10:30:00")],
  tasks: [
    task("task-a", {
      title: "Research paper",
      priority: 1,
      estimatedMinutes: 120,
      remainingMinutes: 120,
      dueAt: chicago("2026-08-28", "17:00:00"),
    }),
    task("task-b", {
      title: "Quiz prep",
      priority: 3,
      estimatedMinutes: 60,
      remainingMinutes: 60,
      dueAt: chicago(MON, "18:00:00"),
    }),
  ],
  fixedEvents: [],
  expected: {
    mustSchedule: ["task-b"],
    mustMentionReasons: ["deadline"],
  },
};

const S04: PlannerScenario = {
  id: "S04",
  name: "High-priority conflict — cannot fit both fully",
  now: chicago(MON, "09:00:00"),
  timezone: TZ,
  ...dayRange(MON),
  dayKeys: [MON],
  periodType: "day",
  weekStartsOn: 1,
  preferences: {},
  availabilityRules: [dowAvailability(1, "09:00:00", "11:00:00")],
  tasks: [
    task("task-a", {
      title: "Exam review A",
      priority: 1,
      estimatedMinutes: 90,
      remainingMinutes: 90,
      dueAt: chicago(MON, "16:00:00"),
    }),
    task("task-b", {
      title: "Exam review B",
      priority: 1,
      estimatedMinutes: 90,
      remainingMinutes: 90,
      dueAt: chicago(MON, "17:00:00"),
    }),
  ],
  fixedEvents: [],
  expected: {
    mustReportInsufficientCapacity: true,
    minimumUnscheduledMinutes: 60,
    customChecks: ["at-risk-nonempty"],
  },
};

const weekAug24 = weekFromMonday(MON);

const S05: PlannerScenario = {
  id: "S05",
  name: "Weekly insufficient capacity",
  now: chicago(MON, "08:00:00"),
  timezone: TZ,
  ...weekAug24,
  periodType: "week",
  weekStartsOn: 1,
  preferences: {},
  availabilityRules: [0, 1, 2, 3, 4, 5, 6].flatMap((dow) => [
    dowAvailability(dow, "09:00:00", "10:00:00"),
    dowAvailability(dow, "14:00:00", "15:00:00"),
  ]),
  tasks: [
    task("task-w1", {
      title: "Weekly project part 1",
      estimatedMinutes: 420,
      remainingMinutes: 420,
      dueAt: chicago("2026-08-30", "17:00:00"),
    }),
    task("task-w2", {
      title: "Weekly project part 2",
      estimatedMinutes: 420,
      remainingMinutes: 420,
      dueAt: chicago("2026-08-30", "17:00:00"),
    }),
  ],
  fixedEvents: [],
  expected: {
    mustReportInsufficientCapacity: true,
    maximumUnscheduledMinutes: 480,
    minimumUnscheduledMinutes: 360,
  },
};

const S06: PlannerScenario = {
  id: "S06",
  name: "Existing accepted blocks preserved",
  now: chicago(MON, "09:00:00"),
  timezone: TZ,
  ...weekFromMonday(MON),
  dayKeys: [MON, addAppDays(MON, 1), addAppDays(MON, 2)],
  rangeStart: toUtcFromAppLocalDate(MON).toISOString(),
  rangeEnd: toUtcEndOfAppLocalDay(addAppDays(MON, 2)).toISOString(),
  periodType: "week",
  weekStartsOn: 1,
  preferences: {},
  availabilityRules: allWeekdays("09:00:00", "20:00:00"),
  tasks: [
    task("task-thesis", {
      title: "Thesis chapter",
      estimatedMinutes: 180,
      remainingMinutes: 180,
      dueAt: chicago(addAppDays(MON, 4), "17:00:00"),
      splittable: true,
    }),
  ],
  fixedEvents: [],
  existingPlanningBlocks: [
    {
      taskId: "task-thesis",
      startAt: chicago(MON, "18:00:00"),
      endAt: chicago(MON, "19:00:00"),
      accepted: true,
    },
    {
      taskId: "task-thesis",
      startAt: chicago(addAppDays(MON, 1), "18:00:00"),
      endAt: chicago(addAppDays(MON, 1), "19:00:00"),
      accepted: true,
    },
  ],
  expected: {
    mustSchedule: ["task-thesis"],
    totalMinutesByTask: { "task-thesis": 60 },
    maximumBlockCountByTask: { "task-thesis": 1 },
  },
};

const S07: PlannerScenario = {
  id: "S07",
  name: "Partial progress — tracked and future focus",
  now: chicago(MON, "09:00:00"),
  timezone: TZ,
  ...dayRange(MON),
  dayKeys: [MON, addAppDays(MON, 1), addAppDays(MON, 2)],
  rangeStart: toUtcFromAppLocalDate(MON).toISOString(),
  rangeEnd: toUtcEndOfAppLocalDay(addAppDays(MON, 2)).toISOString(),
  periodType: "week",
  weekStartsOn: 1,
  preferences: {},
  availabilityRules: allWeekdays("09:00:00", "17:00:00"),
  tasks: [
    task("task-progress", {
      title: "Lab report",
      estimatedMinutes: 180,
      remainingMinutes: 180,
      trackedMinutes: 70,
      dueAt: chicago(addAppDays(MON, 2), "17:00:00"),
    }),
  ],
  fixedEvents: [
    {
      id: "future-focus",
      title: "Future focus",
      startAt: chicago(addAppDays(MON, 1), "10:00:00"),
      endAt: chicago(addAppDays(MON, 1), "10:40:00"),
      eventType: "focus_block",
      status: "confirmed",
      blocksTime: true,
      relatedTaskId: "task-progress",
    },
  ],
  expected: {
    mustSchedule: ["task-progress"],
    totalMinutesByTask: { "task-progress": 70 },
  },
};

const S08: PlannerScenario = {
  id: "S08",
  name: "Adaptive estimate with calibration provenance",
  now: chicago(MON, "09:00:00"),
  timezone: TZ,
  ...dayRange(MON),
  dayKeys: [MON, addAppDays(MON, 1)],
  rangeStart: toUtcFromAppLocalDate(MON).toISOString(),
  rangeEnd: toUtcEndOfAppLocalDay(addAppDays(MON, 1)).toISOString(),
  periodType: "week",
  weekStartsOn: 1,
  preferences: {},
  availabilityRules: allWeekdays("09:00:00", "17:00:00"),
  tasks: [
    task("task-adaptive", {
      title: "Calibrated reading",
      estimatedMinutes: 100,
      remainingMinutes: 100,
      effectiveEstimateMinutes: 140,
      calibrationMeta: {
        factor: 1.4,
        sampleCount: 8,
        reason: "historical_overrun",
      },
      dueAt: chicago(addAppDays(MON, 1), "17:00:00"),
      splittable: true,
    }),
  ],
  fixedEvents: [],
  expected: {
    mustSchedule: ["task-adaptive"],
    totalMinutesByTask: { "task-adaptive": 140 },
    customChecks: ["calibration-provenance"],
  },
};

const S09: PlannerScenario = {
  id: "S09",
  name: "Calibration below sample threshold — no adaptive apply",
  now: chicago(MON, "09:00:00"),
  timezone: TZ,
  ...dayRange(MON),
  dayKeys: [MON],
  periodType: "day",
  weekStartsOn: 1,
  preferences: {},
  availabilityRules: [dowAvailability(1, "09:00:00", "17:00:00")],
  tasks: [
    task("task-low-samples", {
      title: "Low sample task",
      estimatedMinutes: 100,
      remainingMinutes: 100,
      calibrationMeta: {
        factor: 1.5,
        sampleCount: 3,
        reason: "insufficient_samples",
      },
      dueAt: chicago(MON, "17:00:00"),
    }),
  ],
  fixedEvents: [],
  expected: {
    mustSchedule: ["task-low-samples"],
    totalMinutesByTask: { "task-low-samples": 100 },
  },
};

const S10: PlannerScenario = {
  id: "S10",
  name: "No estimate — skipped and diagnosed",
  now: chicago(MON, "09:00:00"),
  timezone: TZ,
  ...dayRange(MON),
  dayKeys: [MON],
  periodType: "day",
  weekStartsOn: 1,
  preferences: {},
  availabilityRules: [dowAvailability(1, "09:00:00", "17:00:00")],
  tasks: [
    task("task-unestimated", {
      title: "Mystery errand",
      estimatedMinutes: null,
      remainingMinutes: null,
      dueAt: chicago(addAppDays(MON, 1), "17:00:00"),
    }),
  ],
  fixedEvents: [],
  expected: {
    mustNotSchedule: ["task-unestimated"],
    diagnosticsMustIncludeTaskIds: ["task-unestimated"],
  },
};

const WED = addAppDays(MON, 2);

const S11: PlannerScenario = {
  id: "S11",
  name: "Overdue task still eligible",
  now: chicago(WED, "10:00:00"),
  timezone: TZ,
  ...dayRange(WED),
  dayKeys: [WED],
  periodType: "day",
  weekStartsOn: 1,
  preferences: {},
  availabilityRules: [dowAvailability(3, "09:00:00", "17:00:00")],
  tasks: [
    task("task-overdue", {
      title: "Late homework",
      estimatedMinutes: 60,
      remainingMinutes: 60,
      dueAt: chicago(addAppDays(MON, 1), "17:00:00"),
    }),
  ],
  fixedEvents: [],
  expected: {
    mustSchedule: ["task-overdue"],
    mustMentionReasons: ["overdue"],
  },
};

const S12: PlannerScenario = {
  id: "S12",
  name: "Waiting, deferred, and actionable triage",
  now: chicago(MON, "09:00:00"),
  timezone: TZ,
  ...dayRange(MON),
  dayKeys: [MON],
  periodType: "day",
  weekStartsOn: 1,
  preferences: {},
  availabilityRules: [dowAvailability(1, "09:00:00", "17:00:00")],
  tasks: [
    task("task-waiting", {
      title: "Waiting on reply",
      estimatedMinutes: 60,
      remainingMinutes: 60,
      workflowState: "waiting",
      dueAt: chicago(MON, "17:00:00"),
    }),
    task("task-deferred", {
      title: "Deferred chore",
      estimatedMinutes: 45,
      remainingMinutes: 45,
      deferredUntilAt: chicago(addAppDays(MON, 1), "09:00:00"),
      dueAt: chicago(addAppDays(MON, 3), "17:00:00"),
    }),
    task("task-actionable", {
      title: "Actionable today",
      estimatedMinutes: 60,
      remainingMinutes: 60,
      dueAt: chicago(MON, "17:00:00"),
    }),
  ],
  fixedEvents: [],
  expected: {
    mustSchedule: ["task-actionable"],
    mustNotSchedule: ["task-waiting", "task-deferred"],
  },
};

const THU = addAppDays(MON, 3);
const NEXT_THU = addAppDays(THU, 14);

const S13: PlannerScenario = {
  id: "S13",
  name: "Recurring instances — template never scheduled",
  now: chicago(MON, "09:00:00"),
  timezone: TZ,
  ...weekAug24,
  periodType: "week",
  weekStartsOn: 1,
  preferences: {},
  availabilityRules: allWeekdays("09:00:00", "17:00:00"),
  tasks: [
    task("recur-template", {
      title: "Weekly review template",
      estimatedMinutes: 60,
      remainingMinutes: 60,
      isRecurrenceTemplate: true,
      dueAt: chicago(NEXT_THU, "17:00:00"),
    }),
    task("recur-instance-current", {
      title: "Weekly review",
      estimatedMinutes: 60,
      remainingMinutes: 60,
      dueAt: chicago(THU, "17:00:00"),
    }),
    task("recur-instance-next", {
      title: "Weekly review (next)",
      estimatedMinutes: 60,
      remainingMinutes: 60,
      dueAt: chicago(NEXT_THU, "17:00:00"),
      earliestStartAt: chicago(NEXT_THU, "09:00:00"),
    }),
  ],
  fixedEvents: [],
  expected: {
    mustSchedule: ["recur-instance-current"],
    mustNotSchedule: ["recur-template", "recur-instance-next"],
  },
};

const S14: PlannerScenario = {
  id: "S14",
  name: "Split 180 minutes across Mon–Wed",
  now: chicago(MON, "09:00:00"),
  timezone: TZ,
  dayKeys: [MON, addAppDays(MON, 1), addAppDays(MON, 2)],
  rangeStart: toUtcFromAppLocalDate(MON).toISOString(),
  rangeEnd: toUtcEndOfAppLocalDay(addAppDays(MON, 2)).toISOString(),
  periodType: "week",
  weekStartsOn: 1,
  preferences: {
    preferredFocusBlockMinutes: 60,
    maximumFocusBlockMinutes: 60,
  },
  availabilityRules: [
    dowAvailability(1, "09:00:00", "11:00:00"),
    dowAvailability(2, "09:00:00", "11:00:00"),
    dowAvailability(3, "09:00:00", "11:00:00"),
  ],
  tasks: [
    task("task-split", {
      title: "Split reading",
      estimatedMinutes: 180,
      remainingMinutes: 180,
      dueAt: chicago(addAppDays(MON, 2), "17:00:00"),
      splittable: true,
      minimumBlockMinutes: 60,
    }),
  ],
  fixedEvents: [],
  expected: {
    mustSchedule: ["task-split"],
    totalMinutesByTask: { "task-split": 180 },
    exactBlockCountByTask: { "task-split": 3 },
  },
};

const S15: PlannerScenario = {
  id: "S15",
  name: "Prefer single block over fragmented gaps",
  now: chicago(MON, "09:00:00"),
  timezone: TZ,
  ...dayRange(MON),
  dayKeys: [MON],
  periodType: "day",
  weekStartsOn: 1,
  preferences: {
    preferredFocusBlockMinutes: 120,
    maximumFocusBlockMinutes: 120,
  },
  availabilityRules: [
    dowAvailability(1, "09:00:00", "11:00:00"),
    dowAvailability(1, "14:00:00", "14:30:00"),
    dowAvailability(1, "15:00:00", "15:30:00"),
    dowAvailability(1, "16:00:00", "16:30:00"),
    dowAvailability(1, "17:00:00", "17:30:00"),
  ],
  tasks: [
    task("task-frag", {
      title: "Deep work session",
      estimatedMinutes: 120,
      remainingMinutes: 120,
      dueAt: chicago(MON, "18:00:00"),
      splittable: false,
      minimumBlockMinutes: 120,
    }),
  ],
  fixedEvents: [],
  expected: {
    mustSchedule: ["task-frag"],
    totalMinutesByTask: { "task-frag": 120 },
    maximumBlockCountByTask: { "task-frag": 1 },
  },
};

const S16: PlannerScenario = {
  id: "S16",
  name: "Maximum focus block size enforced",
  now: chicago(MON, "09:00:00"),
  timezone: TZ,
  ...weekFromMonday(MON),
  dayKeys: [MON, addAppDays(MON, 1), addAppDays(MON, 2)],
  rangeStart: toUtcFromAppLocalDate(MON).toISOString(),
  rangeEnd: toUtcEndOfAppLocalDay(addAppDays(MON, 2)).toISOString(),
  periodType: "week",
  weekStartsOn: 1,
  preferences: {
    maximumFocusBlockMinutes: 90,
    preferredFocusBlockMinutes: 90,
  },
  availabilityRules: allWeekdays("09:00:00", "17:00:00"),
  tasks: [
    task("task-long", {
      title: "Long assignment",
      estimatedMinutes: 180,
      remainingMinutes: 180,
      dueAt: chicago(addAppDays(MON, 2), "17:00:00"),
      splittable: true,
    }),
  ],
  fixedEvents: [],
  expected: {
    mustSchedule: ["task-long"],
    totalMinutesByTask: { "task-long": 180 },
  },
};

const S17: PlannerScenario = {
  id: "S17",
  name: "Minimum break between consecutive tasks",
  now: chicago(MON, "09:00:00"),
  timezone: TZ,
  ...dayRange(MON),
  dayKeys: [MON],
  periodType: "day",
  weekStartsOn: 1,
  preferences: {
    minimumBreakMinutes: 15,
    preferredFocusBlockMinutes: 60,
    maximumFocusBlockMinutes: 60,
  },
  availabilityRules: [dowAvailability(1, "09:00:00", "11:30:00")],
  tasks: [
    task("task-break-a", {
      title: "First focus task",
      estimatedMinutes: 60,
      remainingMinutes: 60,
      dueAt: chicago(MON, "17:00:00"),
      priority: 1,
    }),
    task("task-break-b", {
      title: "Second focus task",
      estimatedMinutes: 60,
      remainingMinutes: 60,
      dueAt: chicago(MON, "17:00:00"),
      priority: 2,
    }),
  ],
  fixedEvents: [],
  expected: {
    mustSchedule: ["task-break-a", "task-break-b"],
    exactBlockCount: 2,
  },
};

const S18: PlannerScenario = {
  id: "S18",
  name: "Class and work events remain blocking",
  now: chicago(MON, "09:00:00"),
  timezone: TZ,
  ...dayRange(MON),
  dayKeys: [MON],
  periodType: "day",
  weekStartsOn: 1,
  preferences: {},
  availabilityRules: [dowAvailability(1, "08:00:00", "18:00:00")],
  fixedEvents: [
    event("block-class", MON, "10:00:00", "11:00:00", {
      eventType: "class",
      source: "canvas",
    }),
    event("block-work", MON, "13:00:00", "17:00:00", {
      eventType: "work",
      source: "manual",
    }),
  ],
  tasks: [
    task("task-around", {
      title: "Study between commitments",
      estimatedMinutes: 60,
      remainingMinutes: 60,
      dueAt: chicago(MON, "18:00:00"),
    }),
  ],
  expected: {
    mustSchedule: ["task-around"],
    noOverlapEventIds: ["block-class", "block-work"],
  },
};

const S19: PlannerScenario = {
  id: "S19",
  name: "Non-blocking personal event preserves availability",
  now: chicago(MON, "09:00:00"),
  timezone: TZ,
  ...dayRange(MON),
  dayKeys: [MON],
  periodType: "day",
  weekStartsOn: 1,
  preferences: {},
  availabilityRules: [dowAvailability(1, "09:00:00", "12:00:00")],
  fixedEvents: [
    event("personal-soft", MON, "10:00:00", "11:00:00", {
      eventType: "personal",
      blocksTime: false,
    }),
  ],
  tasks: [
    task("task-soft", {
      title: "Morning focus",
      estimatedMinutes: 90,
      remainingMinutes: 90,
      dueAt: chicago(MON, "12:00:00"),
      splittable: false,
      minimumBlockMinutes: 90,
    }),
  ],
  expected: {
    mustSchedule: ["task-soft"],
    totalMinutesByTask: { "task-soft": 90 },
    noOverlapEventIds: [],
  },
};

const S20: PlannerScenario = {
  id: "S20",
  name: "All-day deadline marker does not block scheduling",
  now: chicago(MON, "09:00:00"),
  timezone: TZ,
  ...dayRange(MON),
  dayKeys: [MON],
  periodType: "day",
  weekStartsOn: 1,
  preferences: {},
  availabilityRules: [dowAvailability(1, "09:00:00", "17:00:00")],
  fixedEvents: [
    {
      id: "deadline-marker",
      title: "Essay due",
      startAt: toUtcFromAppLocalDate(MON).toISOString(),
      endAt: toUtcEndOfAppLocalDay(MON).toISOString(),
      allDay: true,
      eventType: "deadline",
      blocksTime: false,
      status: "confirmed",
    },
  ],
  tasks: [
    task("task-essay", {
      title: "Finish essay",
      estimatedMinutes: 60,
      remainingMinutes: 60,
      dueAt: chicago(MON, "17:00:00"),
    }),
  ],
  expected: {
    mustSchedule: ["task-essay"],
    totalMinutesByTask: { "task-essay": 60 },
  },
};

const FRI = addAppDays(MON, 4);
const SAT = addAppDays(MON, 5);

const S21: PlannerScenario = {
  id: "S21",
  name: "Cross-midnight availability until deadline",
  now: chicago(FRI, "21:00:00"),
  timezone: TZ,
  dayKeys: [FRI, SAT],
  rangeStart: toUtcFromAppLocalDate(FRI).toISOString(),
  rangeEnd: toUtcEndOfAppLocalDay(SAT).toISOString(),
  periodType: "day",
  weekStartsOn: 1,
  preferences: {},
  availabilityRules: [
    dowAvailability(5, "22:00:00", "23:59:59"),
    dowAvailability(6, "00:00:00", "01:00:00"),
  ],
  tasks: [
    task("task-late", {
      title: "Late night cram",
      estimatedMinutes: 90,
      remainingMinutes: 90,
      dueAt: chicago(SAT, "00:30:00"),
      splittable: true,
      minimumBlockMinutes: 30,
    }),
  ],
  fixedEvents: [],
  expected: {
    mustSchedule: ["task-late"],
    latestEndByTask: { "task-late": chicago(SAT, "00:30:00") },
  },
};

const S22_SPRING: PlannerScenario = {
  id: "S22-spring",
  name: "DST spring forward — duration correctness",
  now: chicago("2026-03-08", "08:00:00"),
  timezone: TZ,
  ...dayRange("2026-03-08"),
  dayKeys: ["2026-03-08"],
  periodType: "day",
  weekStartsOn: 1,
  preferences: {},
  availabilityRules: [dowAvailability(0, "08:00:00", "20:00:00")],
  tasks: [
    task("task-dst-spring", {
      title: "DST spring task",
      estimatedMinutes: 60,
      remainingMinutes: 60,
      dueAt: chicago("2026-03-08", "19:00:00"),
    }),
  ],
  fixedEvents: [],
  expected: {
    mustSchedule: ["task-dst-spring"],
    totalMinutesByTask: { "task-dst-spring": 60 },
  },
};

const S22_FALL: PlannerScenario = {
  id: "S22-fall",
  name: "DST fall back — duration correctness",
  now: chicago("2026-11-01", "08:00:00"),
  timezone: TZ,
  ...dayRange("2026-11-01"),
  dayKeys: ["2026-11-01"],
  periodType: "day",
  weekStartsOn: 1,
  preferences: {},
  availabilityRules: [dowAvailability(0, "08:00:00", "20:00:00")],
  tasks: [
    task("task-dst-fall", {
      title: "DST fall task",
      estimatedMinutes: 60,
      remainingMinutes: 60,
      dueAt: chicago("2026-11-01", "19:00:00"),
    }),
  ],
  fixedEvents: [],
  expected: {
    mustSchedule: ["task-dst-fall"],
    totalMinutesByTask: { "task-dst-fall": 60 },
  },
};

const SUN = addAppDays(MON, 6);
const NEXT_MON = addAppDays(SUN, 1);
const nextWeek = weekFromMonday(NEXT_MON);

const S23: PlannerScenario = {
  id: "S23",
  name: "Week boundary — plan next week from Sunday evening",
  now: chicago(SUN, "18:00:00"),
  timezone: TZ,
  ...nextWeek,
  periodType: "week",
  weekStartsOn: 1,
  preferences: {},
  availabilityRules: allWeekdays("09:00:00", "17:00:00"),
  tasks: [
    task("task-next-week", {
      title: "Next week prep",
      estimatedMinutes: 60,
      remainingMinutes: 60,
      dueAt: chicago(addAppDays(NEXT_MON, 2), "17:00:00"),
    }),
  ],
  fixedEvents: [],
  expected: {
    mustSchedule: ["task-next-week"],
    totalMinutesByTask: { "task-next-week": 60 },
  },
};

const S24: PlannerScenario = {
  id: "S24",
  name: "Daily priority receives favorable ranking",
  now: chicago(MON, "09:00:00"),
  timezone: TZ,
  ...dayRange(MON),
  dayKeys: [MON],
  periodType: "day",
  weekStartsOn: 1,
  preferences: {},
  availabilityRules: [dowAvailability(1, "09:00:00", "11:00:00")],
  tasks: [
    task("task-regular", {
      title: "Regular task",
      priority: 2,
      estimatedMinutes: 60,
      remainingMinutes: 60,
      dueAt: chicago("2026-08-28", "17:00:00"),
    }),
    task("task-daily-pri", {
      title: "Daily priority task",
      priority: 4,
      isDailyPriority: true,
      estimatedMinutes: 60,
      remainingMinutes: 60,
      dueAt: chicago("2026-08-28", "17:00:00"),
    }),
  ],
  fixedEvents: [],
  expected: {
    mustSchedule: ["task-daily-pri"],
    mustMentionReasons: ["daily"],
  },
};

const S25: PlannerScenario = {
  id: "S25",
  name: "Weekly priority influence",
  now: chicago(MON, "09:00:00"),
  timezone: TZ,
  ...dayRange(MON),
  dayKeys: [MON],
  periodType: "day",
  weekStartsOn: 1,
  preferences: {},
  availabilityRules: [dowAvailability(1, "09:00:00", "11:00:00")],
  tasks: [
    task("task-normal", {
      title: "Normal task",
      priority: 3,
      estimatedMinutes: 60,
      remainingMinutes: 60,
      dueAt: chicago("2026-08-28", "17:00:00"),
    }),
    task("task-weekly-pri", {
      title: "Weekly priority task",
      priority: 4,
      isWeeklyPriority: true,
      estimatedMinutes: 60,
      remainingMinutes: 60,
      dueAt: chicago("2026-08-28", "17:00:00"),
    }),
  ],
  fixedEvents: [],
  expected: {
    mustSchedule: ["task-weekly-pri"],
    mustMentionReasons: ["weekly"],
  },
};

const S26: PlannerScenario = {
  id: "S26",
  name: "Avoid difficult work after evening cutoff",
  now: chicago(MON, "09:00:00"),
  timezone: TZ,
  ...dayRange(MON),
  dayKeys: [MON],
  periodType: "day",
  weekStartsOn: 1,
  preferences: {
    avoidDifficultWorkAfter: "20:00:00",
  },
  availabilityRules: [dowAvailability(1, "09:00:00", "22:00:00")],
  tasks: [
    task("task-hard", {
      title: "Difficult problem set",
      difficulty: 5,
      estimatedMinutes: 60,
      remainingMinutes: 60,
      dueAt: chicago(MON, "22:00:00"),
    }),
  ],
  fixedEvents: [],
  expected: {
    mustSchedule: ["task-hard"],
    totalMinutesByTask: { "task-hard": 60 },
    latestEndByTask: { "task-hard": chicago(MON, "20:00:00") },
  },
};

const S27: PlannerScenario = {
  id: "S27",
  name: "Deterministic output across repeated runs",
  now: chicago(MON, "09:00:00"),
  timezone: TZ,
  ...dayRange(MON),
  dayKeys: [MON],
  periodType: "day",
  weekStartsOn: 1,
  preferences: {},
  availabilityRules: [dowAvailability(1, "09:00:00", "17:00:00")],
  tasks: [
    task("task-det", {
      title: "Determinism check",
      estimatedMinutes: 60,
      remainingMinutes: 60,
      dueAt: chicago(MON, "17:00:00"),
      priority: 2,
    }),
    task("task-det-b", {
      title: "Determinism check B",
      estimatedMinutes: 45,
      remainingMinutes: 45,
      dueAt: chicago(MON, "17:00:00"),
      priority: 3,
    }),
  ],
  fixedEvents: [],
  expected: {
    requireDeterministic: true,
    customChecks: ["determinism-100"],
  },
};

const S28: PlannerScenario = {
  id: "S28",
  name: "Idempotent proposal acceptance",
  now: chicago(MON, "09:00:00"),
  timezone: TZ,
  ...dayRange(MON),
  dayKeys: [MON],
  periodType: "day",
  weekStartsOn: 1,
  preferences: {},
  availabilityRules: [dowAvailability(1, "09:00:00", "17:00:00")],
  tasks: [
    task("task-idem", {
      title: "Idempotency check",
      estimatedMinutes: 60,
      remainingMinutes: 60,
      dueAt: chicago(MON, "17:00:00"),
    }),
  ],
  fixedEvents: [],
  expected: {
    requireIdempotentAccept: true,
    mustSchedule: ["task-idem"],
  },
};

/** All benchmark scenarios S01–S28 (S22 includes spring and fall sub-scenarios). */
export const PLANNER_SCENARIOS: PlannerScenario[] = [
  S01,
  S02,
  S03,
  S04,
  S05,
  S06,
  S07,
  S08,
  S09,
  S10,
  S11,
  S12,
  S13,
  S14,
  S15,
  S16,
  S17,
  S18,
  S19,
  S20,
  S21,
  S22_SPRING,
  S22_FALL,
  S23,
  S24,
  S25,
  S26,
  S27,
  S28,
];

export function getScenarioById(id: string): PlannerScenario | undefined {
  return PLANNER_SCENARIOS.find((scenario) => scenario.id === id);
}
