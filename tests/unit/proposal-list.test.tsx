import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProposalCard } from "@/components/planning/proposal-card";
import { PlanningControls } from "@/components/planning/planning-controls";

const proposal = {
  id: "proposal-1",
  user_id: "user-1",
  planning_run_id: "run-1",
  task_id: "task-1",
  proposed_start_at: "2026-07-13T15:00:00.000Z",
  proposed_end_at: "2026-07-13T16:00:00.000Z",
  proposed_minutes: 60,
  status: "pending",
  explanation: {
    reason: "earliest_due_high_priority",
    dueAt: "2026-07-16T04:59:00.000Z",
    availableIntervalMinutes: 120,
    taskRemainingMinutes: 180,
    scheduledTaskMinutesBeforeProposal: 0,
    preferenceMatches: ["preferred_block_length"],
    preferenceViolations: [],
  },
  proposal_hash: "hash",
  created_event_id: null,
  created_at: "2026-07-13T12:00:00.000Z",
  updated_at: "2026-07-13T12:00:00.000Z",
  accepted_at: null,
  rejected_at: null,
  task_title: "Essay draft",
  task_due_at: "2026-07-16T04:59:00.000Z",
};

describe("ProposalCard", () => {
  it("renders proposal details and actions", () => {
    render(<ProposalCard proposal={proposal} />);

    expect(screen.getByText("Essay draft")).toBeInTheDocument();
    expect(screen.getByText("60 min")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  it("shows stale warning for stale proposals", () => {
    render(
      <ProposalCard proposal={{ ...proposal, status: "stale" }} />,
    );

    expect(screen.getByText("Stale")).toBeInTheDocument();
    expect(
      screen.getByText(/out of date/i),
    ).toBeInTheDocument();
  });
});

describe("PlanningControls", () => {
  it("renders plan today button when no run exists", () => {
    render(<PlanningControls periodType="day" planningRun={null} />);

    expect(screen.getByRole("button", { name: "Plan today" })).toBeInTheDocument();
    expect(
      screen.getByText(/Nothing is added to your calendar until you accept/i),
    ).toBeInTheDocument();
  });

  it("renders unschedulable task warning from summary", () => {
    render(
      <PlanningControls
        periodType="week"
        planningRun={{
          run: {
            id: "run-1",
            user_id: "user-1",
            period_start: "2026-07-13T05:00:00.000Z",
            period_end: "2026-07-20T04:59:59.000Z",
            status: "generated",
            input_hash: "hash",
            summary: {
              unschedulableTasks: [
                {
                  taskId: "task-1",
                  taskTitle: "Big report",
                  reason: "No single interval could fit all remaining work.",
                },
              ],
            },
            created_at: "2026-07-13T12:00:00.000Z",
            updated_at: "2026-07-13T12:00:00.000Z",
          },
          proposals: [],
        }}
      />,
    );

    expect(screen.getByText(/Big report/)).toBeInTheDocument();
  });
});
