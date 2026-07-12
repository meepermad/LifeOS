import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TodayView } from "@/components/today/today-view";
import type { WorkloadSummary } from "@/lib/planning/types";

const workload: WorkloadSummary = {
  periodType: "day",
  periodStart: "2026-07-13T05:00:00.000Z",
  periodEnd: "2026-07-14T04:59:59.000Z",
  fixedMinutes: 450,
  rawOpenMinutes: 135,
  reservedBufferMinutes: 27,
  availableFocusMinutes: 108,
  requiredTaskMinutes: 90,
  allocatedTaskMinutes: 75,
  unallocatedTaskMinutes: 15,
  scheduledFocusMinutes: 0,
  unestimatedTaskCount: 2,
  overdueTaskCount: 1,
  capacityRatio: 0.69,
  status: "incomplete_data",
  hasIncompleteData: true,
  needsAvailabilityConfiguration: false,
  daySummaries: [
    {
      dateKey: "2026-07-13",
      availabilityMinutes: 585,
      fixedMinutes: 450,
      rawOpenMinutes: 135,
      reservedBufferMinutes: 27,
      availableFocusMinutes: 108,
      scheduledFocusMinutes: 0,
      needsAvailabilityConfiguration: false,
      recommendedTaskMinutes: 75,
      requiredTaskMinutes: 90,
      capacityRatio: 0.69,
      status: "incomplete_data",
      hasIncompleteData: true,
    },
  ],
  allocation: {
    perDayAllocations: [
      { dateKey: "2026-07-13", allocatedMinutes: 75, taskEntries: [] },
    ],
    allocatedTaskMinutes: 75,
    unallocatedTaskMinutes: 15,
    tasksAtRisk: [],
    tasksImpossibleBeforeDeadline: [],
    taskEntries: [],
  },
  tentativeEventIds: [],
  unestimatedTaskIds: ["task-1", "task-2"],
  highestPressureDays: ["2026-07-13"],
  explanation: ["Test explanation"],
};

describe("TodayView", () => {
  it("renders workload summary and missing-estimate warning", () => {
    render(
      <TodayView
        events={[]}
        dueToday={[]}
        overdue={[]}
        allocatedToday={[]}
        nextEvent={null}
        workload={workload}
        canvasTasksNeedingEstimates={[]}
        relatedTasksByEventId={new Map()}
        planningRun={null}
      />,
    );

    expect(screen.getByText(/Today is heavy|Today needs more task estimates/i)).toBeInTheDocument();
    expect(screen.getByText(/Available focus time/i)).toBeInTheDocument();
    expect(screen.getByText(/2 tasks lack estimates/i)).toBeInTheDocument();
  });

  it("renders an empty state when there are no events or tasks", () => {
    render(
      <TodayView
        events={[]}
        dueToday={[]}
        overdue={[]}
        allocatedToday={[]}
        nextEvent={null}
        workload={null}
        canvasTasksNeedingEstimates={[]}
        relatedTasksByEventId={new Map()}
        planningRun={null}
      />,
    );

    expect(
      screen.getByText(/Your day is clear/i),
    ).toBeInTheDocument();
  });

  it("renders canvas tasks needing estimates", () => {
    render(
      <TodayView
        events={[]}
        dueToday={[]}
        overdue={[]}
        allocatedToday={[]}
        nextEvent={null}
        workload={null}
        canvasTasksNeedingEstimates={[
          { id: "task-1", title: "Assignment 3", due_at: "2026-07-13T23:59:00.000Z" },
        ]}
        relatedTasksByEventId={new Map()}
        planningRun={null}
      />,
    );

    expect(screen.getByText(/Canvas tasks needing estimates/i)).toBeInTheDocument();
    expect(screen.getByText("Assignment 3")).toBeInTheDocument();
    expect(screen.getByText(/Estimate needed/i)).toBeInTheDocument();
  });
});
