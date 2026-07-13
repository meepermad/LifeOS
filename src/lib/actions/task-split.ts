"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { splitTask } from "@/lib/data/task-split";
import { AppError } from "@/lib/errors/app-error";
import type { ActionResult } from "@/lib/actions/tasks";

const splitTaskSchema = z.object({
  taskId: z.string().uuid(),
  children: z
    .array(
      z.object({
        title: z.string().trim().min(1, "Title is required"),
        remainingMinutes: z.coerce.number().int().min(1),
      }),
    )
    .min(2, "Provide at least two subtasks"),
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

export async function splitTaskAction(
  input: unknown,
): Promise<ActionResult<{ parentId: string; childIds: string[] }>> {
  try {
    const parsed = splitTaskSchema.parse(input);
    const result = await splitTask(parsed);

    revalidatePath("/today");
    revalidatePath("/week");
    revalidatePath("/tasks");
    revalidatePath("/calendar");

    return { success: true, data: result };
  } catch (error) {
    return toActionError(error);
  }
}
