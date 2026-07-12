import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskListItem } from "@/components/tasks/task-list-item";
import type { TaskRow } from "@/types/domain";

const task: TaskRow = {
  id: "task-1",
  user_id: "user-1",
  title: "Essay draft",
  description: null,
  source: "manual",
  external_task_id: null,
  due_at: "2026-07-16T04:59:00.000Z",
  earliest_start_at: null,
  estimated_minutes: 180,
  remaining_minutes: 120,
  actual_minutes: null,
  priority: 2,
  difficulty: 4,
  status: "open",
  splittable: true,
  minimum_block_minutes: 25,
  related_event_id: null,
  sync_managed: false,
  cancelled_by_sync: false,
  source_content_hash: null,
  completed_at: null,
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
};

describe("TaskListItem focus schedule", () => {
  it("shows remaining and unscheduled focus minutes", () => {
    render(
      <TaskListItem
        task={task}
        focusSummary={{
          taskId: task.id,
          remainingMinutes: 120,
          futureScheduledFocusMinutes: 60,
          unscheduledRemainingMinutes: 60,
          nextFocusBlock: {
            id: "event-1",
            startAt: "2026-07-14T15:00:00.000Z",
            endAt: "2026-07-14T16:00:00.000Z",
          },
        }}
      />,
    );

    expect(screen.getAllByText(/Remaining 120m/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Scheduled focus 60m/)).toBeInTheDocument();
    expect(screen.getByText(/Unscheduled remaining 60m/)).toBeInTheDocument();
    expect(screen.getByText(/Next focus block/)).toBeInTheDocument();
  });
});
