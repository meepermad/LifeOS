"use server";

import { revalidatePath } from "next/cache";
import { upsertPlanningBlockFeedback } from "@/lib/data/planning-feedback";
import type { PlanningBlockFeedback } from "@/lib/data/planning-feedback";
import { AppError } from "@/lib/errors/app-error";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

function toActionError<T = void>(error: unknown): ActionResult<T> {
  if (error instanceof AppError) {
    return { success: false, error: error.message };
  }
  return { success: false, error: "An unexpected error occurred" };
}

export async function submitPlanningBlockFeedbackAction(input: {
  eventId: string;
  feedback: PlanningBlockFeedback;
  note?: string | null;
  partialMinutes?: number | null;
}): Promise<ActionResult> {
  try {
    await upsertPlanningBlockFeedback(input);
    revalidatePath("/calendar");
    revalidatePath("/today");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}
