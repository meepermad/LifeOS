import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeekWorkloadSummary } from "@/components/workload/week-workload-summary";
import type { WorkloadSummary } from "@/lib/planning/types";

const workload: WorkloadSummary = {
  periodType: "week",
  periodStart: "2026-07-12T05:00:00.000Z",
  periodEnd: "2026-07-19T04:59:59.000Z",
  fixedMinutes: 1200,
  rawOpenMinutes: 1800,
  reservedBufferMinutes: 360,
  availableFocusMinutes: 1440,
  requiredTaskMinutes: 600,
  allocatedTaskMinutes: 540,
  unallocatedTaskMinutes: 60,
  scheduledFocusMinutes: 120,
  unestimatedTaskCount: 1,
  overdueTaskCount: 0,
  capacityRatio: 0.375,
  status: "manageable",
  hasIncompleteData: false,
  needsAvailabilityConfiguration: false,
  daySummaries: [],
  allocation: {
    perDayAllocations: [],
    allocatedTaskMinutes: 540,
    unallocatedTaskMinutes: 60,
    tasksAtRisk: ["task-1"],
    tasksImpossibleBeforeDeadline: [],
    taskEntries: [],
  },
  tentativeEventIds: [],
  unestimatedTaskIds: [],
  highestPressureDays: ["2026-07-15"],
  explanation: [],
};

describe("WeekWorkloadSummary", () => {
  it("renders weekly workload breakdown", () => {
    render(<WeekWorkloadSummary workload={workload} />);

    expect(screen.getByText(/Weekly workload/i)).toBeInTheDocument();
    expect(screen.getByText(/Available focus time/i)).toBeInTheDocument();
    expect(screen.getByText(/Highest-pressure days/i)).toBeInTheDocument();
  });
});
