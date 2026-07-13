"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import {
  createRecurrenceTemplate,
  materializeTaskInstances,
  moveRecurrenceOccurrence,
  pauseRecurrenceTemplate,
  resumeRecurrenceTemplate,
  skipRecurrenceOccurrence,
} from "@/lib/data/recurrence";
import { AppError } from "@/lib/errors/app-error";
import type { ActionResult } from "@/lib/actions/tasks";

function toActionError<T = void>(error: unknown): ActionResult<T> {
  if (error instanceof ZodError) {
    return { success: false, error: "Validation failed" };
  }
  if (error instanceof AppError) {
    return { success: false, error: error.message };
  }
  return { success: false, error: "An unexpected error occurred" };
}

export async function createRecurrenceTemplateAction(input: {
  title: string;
  description?: string | null;
  recurrenceRule: unknown;
  firstOccurrenceDate: string;
  dueTime?: string | null;
  defaultEstimateMinutes?: number | null;
  defaultPriority?: number;
  byWeekday?: number[];
}): Promise<ActionResult<{ id: string }>> {
  try {
    const rule =
      input.byWeekday && input.byWeekday.length > 0
        ? {
            frequency: "weekly" as const,
            interval: 1,
            byWeekday: input.byWeekday,
          }
        : input.recurrenceRule;

    const template = await createRecurrenceTemplate({
      title: input.title,
      description: input.description,
      recurrenceRule: rule,
      firstOccurrenceDate: input.firstOccurrenceDate,
      dueTime: input.dueTime,
      defaultEstimateMinutes: input.defaultEstimateMinutes,
      defaultPriority: input.defaultPriority,
    });

    revalidatePath("/tasks/recurring");
    revalidatePath("/tasks");
    return { success: true, data: { id: template.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function pauseRecurrenceTemplateAction(
  templateId: string,
): Promise<ActionResult> {
  try {
    await pauseRecurrenceTemplate(templateId);
    revalidatePath("/tasks/recurring");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function resumeRecurrenceTemplateAction(
  templateId: string,
): Promise<ActionResult> {
  try {
    await resumeRecurrenceTemplate(templateId);
    revalidatePath("/tasks/recurring");
    revalidatePath("/tasks");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function skipRecurrenceOccurrenceAction(
  templateId: string,
  occurrenceDate: string,
): Promise<ActionResult> {
  try {
    await skipRecurrenceOccurrence(templateId, occurrenceDate);
    revalidatePath("/tasks/recurring");
    revalidatePath("/tasks");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function moveRecurrenceOccurrenceAction(
  templateId: string,
  occurrenceDate: string,
  movedToDate: string,
): Promise<ActionResult> {
  try {
    await moveRecurrenceOccurrence(templateId, occurrenceDate, movedToDate);
    revalidatePath("/tasks/recurring");
    revalidatePath("/tasks");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function regenerateRecurrenceInstancesAction(
  templateId: string,
): Promise<ActionResult<{ generated: number; skipped: number }>> {
  try {
    const result = await materializeTaskInstances(templateId);
    revalidatePath("/tasks/recurring");
    revalidatePath("/tasks");
    return {
      success: true,
      data: { generated: result.generated, skipped: result.skipped },
    };
  } catch (error) {
    return toActionError(error);
  }
}
