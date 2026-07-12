"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { updateCanvasTaskEstimate } from "@/lib/data/tasks";
import { AppError } from "@/lib/errors/app-error";
import { canvasDeadlineTaskSchema } from "@/lib/planning/schemas";
import { toUtcFromAppLocal } from "@/lib/dates/timezone";
import type { ActionResult } from "@/lib/actions/tasks";

function toActionError<T = void>(error: unknown): ActionResult<T> {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "form";
      fieldErrors[key] = issue.message;
    }
    return {
      success: false,
      error: "Validation failed",
      fieldErrors,
    };
  }

  if (error instanceof AppError) {
    return { success: false, error: error.message };
  }

  return { success: false, error: "An unexpected error occurred" };
}

export async function updateCanvasTaskEstimateAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = canvasDeadlineTaskSchema.parse(input);
    const earliestStartAt = parsed.earliestStartDate
      ? toUtcFromAppLocal(
          parsed.earliestStartDate,
          parsed.earliestStartTime || "00:00",
        ).toISOString()
      : null;

    const task = await updateCanvasTaskEstimate({
      eventId: parsed.eventId,
      estimatedMinutes: parsed.estimatedMinutes,
      priority: parsed.priority,
      difficulty: parsed.difficulty,
      earliestStartAt,
      splittable: parsed.splittable,
      minimumBlockMinutes: parsed.minimumBlockMinutes,
    });

    revalidatePath("/today");
    revalidatePath("/week");
    revalidatePath("/tasks");

    return { success: true, data: { id: task.id } };
  } catch (error) {
    return toActionError(error);
  }
}

/** @deprecated Use updateCanvasTaskEstimateAction */
export async function createTaskFromCanvasDeadlineAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return updateCanvasTaskEstimateAction(input);
}
