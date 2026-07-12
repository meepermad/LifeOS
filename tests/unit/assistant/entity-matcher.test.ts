import { describe, expect, it } from "vitest";
import { matchTasks } from "@/lib/assistant/entity-matcher";
import type { TaskRow } from "@/types/domain";

function task(partial: Partial<TaskRow> & { title: string }): TaskRow {
  return {
    id: partial.id ?? `task-${partial.title}`,
    user_id: "user-1",
    title: partial.title,
    description: null,
    source: "manual",
    due_at: null,
    earliest_start_at: null,
    estimated_minutes: 60,
    remaining_minutes: 60,
    priority: 3,
    difficulty: 3,
    status: partial.status ?? "open",
    splittable: true,
    minimum_block_minutes: 25,
    completed_at: null,
    created_at: "2026-07-13T00:00:00.000Z",
    updated_at: "2026-07-13T00:00:00.000Z",
    related_event_id: null,
    external_task_id: null,
    sync_managed: false,
    source_content_hash: null,
    cancelled_by_sync: false,
    actual_minutes: null,
  };
}

describe("entity-matcher", () => {
  const tasks = [
    task({ id: "1", title: "Statistics Homework" }),
    task({ id: "2", title: "Network Security Homework" }),
    task({ id: "3", title: "Discrete Math Homework" }),
    task({ id: "4", title: "Network Security Lab 4", status: "completed" }),
  ];

  it("finds exact match", () => {
    const result = matchTasks("Network Security Lab 4", tasks);
    expect(result.kind).toBe("none");
  });

  it("finds unique partial match", () => {
    const result = matchTasks("Statistics Homework", tasks);
    expect(result.kind).toBe("exact");
  });

  it("returns multiple for ambiguous homework query", () => {
    const result = matchTasks("homework", tasks);
    expect(result.kind).toBe("multiple");
    if (result.kind === "multiple") {
      expect(result.tasks.length).toBeGreaterThan(1);
    }
  });
});
