"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertNoBlockingOverlap } from "@/lib/data/events";
import {
  createShelfPlanningProposal,
  getTaskFocusScheduleSummaries,
} from "@/lib/data/planning";
import { getTaskById } from "@/lib/data/tasks";
import { isActionableWorkload } from "@/lib/tasks/triage";
import { AppError, ConflictError } from "@/lib/errors/app-error";
import type { ActionResult } from "@/lib/actions/tasks";

const scheduleFromShelfSchema = z.object({
  taskId: z.string().uuid(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  clientRequestId: z.string().min(1).max(128).optional(),
});

function toActionError<T = void>(error: unknown): ActionResult<T> {
  if (error instanceof z.ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "form";
      fieldErrors[key] = issue.message;
    }
    return { success: false, error: "Validation failed", fieldErrors };
  }

  if (error instanceof AppError) {
    return { success: false, error: error.message };
  }

  if (error instanceof Error) {
    return { success: false, error: error.message };
  }

  return { success: false, error: "An unexpected error occurred" };
}

export async function scheduleTaskFromShelfAction(
  input: unknown,
): Promise<
  ActionResult<{
    proposalId: string;
    planningRunId: string;
    idempotent?: boolean;
  }>
> {
  try {
    const parsed = scheduleFromShelfSchema.parse(input);
    const task = await getTaskById(parsed.taskId);

    if (!isActionableWorkload(task)) {
      throw new ConflictError("This task is not actionable right now");
    }

    const startMs = new Date(parsed.startAt).getTime();
    const endMs = new Date(parsed.endAt).getTime();
    if (endMs <= startMs) {
      throw new ConflictError("End time must be after start time");
    }

    if (
      task.earliest_start_at &&
      startMs < new Date(task.earliest_start_at).getTime()
    ) {
      throw new ConflictError(
        "This task cannot start before its earliest start time",
      );
    }

    if (task.due_at && endMs > new Date(task.due_at).getTime()) {
      throw new ConflictError("This block would extend past the task deadline");
    }

    const summaries = await getTaskFocusScheduleSummaries([task]);
    const remaining =
      summaries.get(task.id)?.unscheduledRemainingMinutes ?? 0;
    if (remaining <= 0) {
      throw new ConflictError("This task has no remaining unscheduled work");
    }

    await assertNoBlockingOverlap(parsed.startAt, parsed.endAt);

    const result = await createShelfPlanningProposal({
      taskId: parsed.taskId,
      proposedStartAt: parsed.startAt,
      proposedEndAt: parsed.endAt,
      clientRequestId: parsed.clientRequestId,
    });

    revalidatePath("/calendar");
    revalidatePath("/today");
    revalidatePath("/week");
    revalidatePath("/tasks");

    return { success: true, data: result };
  } catch (error) {
    return toActionError(error);
  }
}

export async function listShelfTasksAction(
  filter: Parameters<
    typeof import("@/lib/planning/task-shelf").getShelfEligibleTasks
  >[0] = {},
): Promise<
  ActionResult<
    Awaited<
      ReturnType<typeof import("@/lib/planning/task-shelf").getShelfEligibleTasks>
    >
  >
> {
  try {
    const { getShelfEligibleTasks } = await import("@/lib/planning/task-shelf");
    const tasks = await getShelfEligibleTasks(filter);
    return { success: true, data: tasks };
  } catch (error) {
    return toActionError(error);
  }
}
