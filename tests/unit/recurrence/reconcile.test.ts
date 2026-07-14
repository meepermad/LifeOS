import { describe, expect, it } from "vitest";
import {
  isInstanceProtectedFromReconcile,
  planFutureInstanceUpdates,
} from "@/lib/recurrence/reconcile";
import type { RecurrenceTemplate } from "@/lib/recurrence/types";
import type { TaskRow } from "@/types/domain";

function makeTemplate(
  overrides: Partial<RecurrenceTemplate> = {},
): RecurrenceTemplate {
  return {
    id: "tpl-1",
    user_id: "user-1",
    title: "Trash",
    description: null,
    task_category: null,
    course_id: null,
    default_estimate_minutes: 15,
    default_priority: 3,
    default_difficulty: 3,
    recurrence_rule: { frequency: "weekly", interval: 1, byWeekday: [0] },
    recurrence_timezone: "America/Chicago",
    first_occurrence_date: "2026-07-01",
    due_time: null,
    generation_horizon_days: 45,
    end_date: null,
    occurrence_limit: null,
    is_active: true,
    paused_at: null,
    archived_at: null,
    ended_at: null,
    future_edit_policy: "update_future_incomplete",
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function makeTask(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: "task-1",
    user_id: "user-1",
    title: "Trash",
    description: null,
    due_at: "2026-07-20T04:59:00.000Z",
    earliest_start_at: null,
    estimated_minutes: 15,
    remaining_minutes: 15,
    actual_minutes: null,
    priority: 3,
    difficulty: 3,
    status: "open",
    splittable: true,
    minimum_block_minutes: 25,
    source: "manual",
    external_task_id: null,
    source_content_hash: null,
    cancelled_by_sync: false,
    related_event_id: null,
    course_id: null,
    sync_managed: false,
    workflow_state: "actionable",
    deferred_until_at: null,
    inbox_at: null,
    completed_at: null,
    created_at: "",
    updated_at: "",
    recurrence_template_id: "tpl-1",
    recurrence_occurrence_key: "2026-07-20",
    parent_task_id: null,
    is_manually_customized: false,
    manually_detached_from_recurrence: false,
    ...overrides,
  };
}

describe("recurrence reconcile policies", () => {
  const template = makeTemplate();
  const now = new Date("2026-07-13T12:00:00.000Z");

  it("protects completed and customized instances", () => {
    expect(
      isInstanceProtectedFromReconcile(
        makeTask({ status: "completed", completed_at: "2026-07-10T00:00:00Z" }),
      ),
    ).toBe(true);
    expect(
      isInstanceProtectedFromReconcile(
        makeTask({ is_manually_customized: true }),
      ),
    ).toBe(true);
  });

  it("update_future_incomplete only selects unprotected future tasks", () => {
    const plan = planFutureInstanceUpdates({
      template,
      now,
      policy: "update_future_incomplete",
      tasks: [
        makeTask({ id: "future", recurrence_occurrence_key: "2026-07-20" }),
        makeTask({
          id: "past",
          recurrence_occurrence_key: "2026-07-01",
        }),
        makeTask({
          id: "custom",
          recurrence_occurrence_key: "2026-07-27",
          is_manually_customized: true,
        }),
        makeTask({
          id: "done",
          recurrence_occurrence_key: "2026-07-25",
          status: "completed",
          completed_at: "2026-07-12T00:00:00Z",
        }),
      ],
    });

    expect(plan.toUpdate.map((t) => t.id)).toEqual(["future"]);
    expect(plan.toCancel).toHaveLength(0);
    expect(plan.protectedSkipped.map((t) => t.id).sort()).toEqual([
      "custom",
      "done",
    ]);
  });

  it("cancel_and_regenerate cancels unprotected future only", () => {
    const plan = planFutureInstanceUpdates({
      template,
      now,
      policy: "cancel_and_regenerate",
      tasks: [
        makeTask({ id: "future", recurrence_occurrence_key: "2026-07-20" }),
        makeTask({
          id: "custom",
          recurrence_occurrence_key: "2026-07-27",
          is_manually_customized: true,
        }),
      ],
    });

    expect(plan.toCancel.map((t) => t.id)).toEqual(["future"]);
    expect(plan.protectedSkipped.map((t) => t.id)).toEqual(["custom"]);
  });

  it("leave_unchanged updates nothing", () => {
    const plan = planFutureInstanceUpdates({
      template,
      now,
      policy: "leave_unchanged",
      tasks: [makeTask({ recurrence_occurrence_key: "2026-07-20" })],
    });
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toCancel).toHaveLength(0);
  });
});
