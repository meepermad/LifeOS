"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import {
  correctCompletionSnapshot,
  createTask,
  deleteTask,
  setTaskCompletion,
  updateTask,
} from "@/lib/data/tasks";
import { buildCompletionReviewPayload } from "@/lib/analytics/time-authority";
import { stopTimer } from "@/lib/data/time-entries";
import { parseTaskForm, type TaskFormInput } from "@/lib/validation/tasks";
import { AppError } from "@/lib/errors/app-error";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

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

export async function createTaskAction(
  input: TaskFormInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = parseTaskForm(input);
    const task = await createTask(parsed);
    revalidatePath("/today");
    revalidatePath("/week");
    revalidatePath("/tasks");
    return { success: true, data: { id: task.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateTaskAction(
  taskId: string,
  input: TaskFormInput,
): Promise<ActionResult> {
  try {
    const parsed = parseTaskForm(input);
    await updateTask(taskId, parsed);
    revalidatePath("/today");
    revalidatePath("/week");
    revalidatePath("/tasks");
    revalidatePath(`/tasks/${taskId}/edit`);
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function completeTaskAction(taskId: string): Promise<ActionResult> {
  try {
    await setTaskCompletion(taskId, true);
    revalidatePath("/today");
    revalidatePath("/week");
    revalidatePath("/tasks");
    revalidatePath("/insights");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function getCompletionReviewAction(taskId: string) {
  try {
    const data = await buildCompletionReviewPayload(taskId);
    return { success: true as const, data };
  } catch (error) {
    return toActionError(error);
  }
}

export async function completeTaskWithReviewAction(input: {
  taskId: string;
  skipSnapshot?: boolean;
  finalActualSeconds?: number;
  adjustmentSeconds?: number;
  stopTimerFirst?: boolean;
  updatedEstimateMinutes?: number | null;
}): Promise<ActionResult> {
  try {
    if (input.stopTimerFirst) {
      await stopTimer();
    }
    await setTaskCompletion(input.taskId, true, {
      skipSnapshot: input.skipSnapshot,
      finalActualSeconds: input.finalActualSeconds,
      adjustmentSeconds: input.adjustmentSeconds,
      updatedEstimateMinutes: input.updatedEstimateMinutes,
    });
    revalidatePath("/today");
    revalidatePath("/week");
    revalidatePath("/tasks");
    revalidatePath("/insights");
    revalidatePath("/calendar");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function correctCompletionSnapshotAction(input: {
  taskId: string;
  finalActualSeconds: number;
  adjustmentSeconds?: number;
  updatedEstimateMinutes?: number | null;
}): Promise<ActionResult> {
  try {
    await correctCompletionSnapshot(input);
    revalidatePath("/today");
    revalidatePath("/tasks");
    revalidatePath("/insights");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function reopenTaskAction(taskId: string): Promise<ActionResult> {
  try {
    await setTaskCompletion(taskId, false);
    revalidatePath("/today");
    revalidatePath("/week");
    revalidatePath("/tasks");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteTaskAction(taskId: string): Promise<ActionResult> {
  try {
    await deleteTask(taskId);
    revalidatePath("/today");
    revalidatePath("/week");
    revalidatePath("/tasks");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}
