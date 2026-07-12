import { describe, expect, it, vi } from "vitest";
import { isReadOnlyIntent, isWriteIntent } from "@/lib/assistant/executor";
import type { ParsedCommand } from "@/lib/assistant/intents";

vi.mock("@/lib/data/events", () => ({
  listEventsInRange: vi.fn(async () => []),
  createEvent: vi.fn(),
  assertNoBlockingOverlap: vi.fn(),
}));

vi.mock("@/lib/data/workload", () => ({
  getCachedWorkload: vi.fn(async () => ({
    periodType: "day",
    periodStart: "",
    periodEnd: "",
    fixedMinutes: 0,
    rawOpenMinutes: 120,
    reservedBufferMinutes: 12,
    availableFocusMinutes: 108,
    requiredTaskMinutes: 60,
    allocatedTaskMinutes: 60,
    unallocatedTaskMinutes: 0,
    scheduledFocusMinutes: 0,
    unestimatedTaskCount: 0,
    overdueTaskCount: 0,
    capacityRatio: 0.5,
    status: "manageable",
    hasIncompleteData: false,
    needsAvailabilityConfiguration: false,
    daySummaries: [],
    allocation: { tasksAtRisk: [], taskAllocations: [] },
    tentativeEventIds: [],
    unestimatedTaskIds: [],
    highestPressureDays: [],
    explanation: [],
  })),
}));

vi.mock("@/lib/data/planning", () => ({
  loadPlanningInputs: vi.fn(async () => ({
    events: [],
    tasks: [],
    availabilityRules: [],
    preferences: {
      minimumBreakMinutes: 10,
      travelBufferMinutes: 15,
      planningBufferPercent: 10,
      preferredFocusBlockMinutes: 60,
      maximumFocusBlockMinutes: 120,
      avoidDifficultWorkAfter: null,
    },
    weekStartsOn: 0,
    now: new Date(),
    periodType: "week",
    periodStart: new Date(),
    periodEnd: new Date(),
    dayKeys: ["2026-07-13"],
    pendingProposalIntervals: [],
    acceptedProposalIntervals: [],
  })),
  generateAndStorePlanningRun: vi.fn(),
  getActivePlanningRun: vi.fn(),
}));

describe("executor intent guards", () => {
  it("identifies read-only intents", () => {
    expect(
      isReadOnlyIntent({ intent: "show_agenda", scope: "today" }),
    ).toBe(true);
    expect(
      isWriteIntent({ intent: "create_event", title: "x", dateKey: "2026-07-13", startTime: "09:00", endTime: "10:00" }),
    ).toBe(true);
    expect(isWriteIntent({ intent: "help" } as ParsedCommand)).toBe(false);
  });
});
