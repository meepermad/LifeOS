"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { z } from "zod";
import {
  archiveInboxItem,
  createInboxTask,
  deferTask,
  markWaiting,
  scheduleInboxFocusBlock,
  setInboxTaskDueDate,
} from "@/lib/data/inbox";
import { deleteTask } from "@/lib/data/tasks";
import { AppError } from "@/lib/errors/app-error";
import type { ActionResult } from "@/lib/actions/tasks";

function toActionError<T = void>(error: unknown): ActionResult<T> {
  if (error instanceof ZodError) {
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

  return { success: false, error: "An unexpected error occurred" };
}

function revalidateInboxPaths() {
  revalidatePath("/inbox");
  revalidatePath("/tasks");
  revalidatePath("/today");
  revalidatePath("/week");
  revalidatePath("/calendar");
}

const captureSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(500),
  description: z.string().max(5000).optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
});

export async function captureInboxTaskAction(
  input: z.infer<typeof captureSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = captureSchema.parse(input);
    const task = await createInboxTask({
      title: parsed.title,
      description: parsed.description,
      dueAt: parsed.dueAt,
    });
    revalidateInboxPaths();
    return { success: true, data: { id: task.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function setInboxDueDateAction(
  taskId: string,
  dueAt: string,
): Promise<ActionResult> {
  try {
    await setInboxTaskDueDate(taskId, dueAt);
    revalidateInboxPaths();
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function scheduleInboxTaskAction(input: {
  taskId: string;
  startAt: string;
  endAt: string;
}): Promise<ActionResult> {
  try {
    await scheduleInboxFocusBlock(input);
    revalidateInboxPaths();
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function markWaitingAction(
  taskId: string,
  input: { reason: string; followUpAt?: string | null },
): Promise<ActionResult> {
  try {
    await markWaiting(taskId, input);
    revalidateInboxPaths();
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deferInboxTaskAction(
  taskId: string,
  untilAt: string,
): Promise<ActionResult> {
  try {
    await deferTask(taskId, untilAt);
    revalidateInboxPaths();
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function archiveInboxTaskAction(
  taskId: string,
): Promise<ActionResult> {
  try {
    await archiveInboxItem(taskId);
    revalidateInboxPaths();
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteInboxTaskAction(
  taskId: string,
): Promise<ActionResult> {
  try {
    await deleteTask(taskId);
    revalidateInboxPaths();
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}
