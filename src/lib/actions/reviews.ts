"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import {
  completeReviewSession,
  recordReviewDecision,
  saveDailyPriorities,
  saveWeeklyPriorities,
  startReviewSession,
} from "@/lib/data/reviews";
import { AppError } from "@/lib/errors/app-error";
import type { Json } from "@/types/database.types";
import type { ActionResult } from "@/lib/actions/tasks";
import type {
  PriorityLevel,
  ReviewDecisionType,
  ReviewType,
} from "@/lib/reviews/types";

function toActionError<T = void>(error: unknown): ActionResult<T> {
  if (error instanceof ZodError) {
    return { success: false, error: "Validation failed" };
  }
  if (error instanceof AppError) {
    return { success: false, error: error.message };
  }
  return { success: false, error: "An unexpected error occurred" };
}

function revalidateReviewPaths() {
  revalidatePath("/today");
  revalidatePath("/review/daily");
  revalidatePath("/review/weekly");
}

export async function startReviewSessionAction(input: {
  reviewType: ReviewType;
  reviewDate?: string;
  reviewWeekStart?: string;
}): Promise<ActionResult<{ sessionId: string; created: boolean }>> {
  try {
    const scope =
      input.reviewType === "weekly"
        ? {
            reviewType: input.reviewType,
            reviewWeekStart: input.reviewWeekStart!,
          }
        : {
            reviewType: input.reviewType,
            reviewDate: input.reviewDate!,
          };

    const { session, created } = await startReviewSession(scope);
    revalidateReviewPaths();
    return {
      success: true,
      data: { sessionId: session.id, created },
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function completeReviewSessionAction(input: {
  sessionId: string;
  summary?: Record<string, unknown> | null;
}): Promise<ActionResult<{ idempotent: boolean }>> {
  try {
    const { idempotent } = await completeReviewSession(
      input.sessionId,
      input.summary as Json | null | undefined,
    );
    revalidateReviewPaths();
    return { success: true, data: { idempotent } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function recordReviewDecisionAction(input: {
  sessionId: string;
  taskId?: string | null;
  decisionType: ReviewDecisionType;
  decisionPayload?: Record<string, unknown> | null;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const decision = await recordReviewDecision(input);
    revalidateReviewPaths();
    return { success: true, data: { id: decision.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function saveDailyPrioritiesAction(input: {
  priorityDate: string;
  priorities: Array<{
    taskId: string;
    priorityRank: number;
    priorityLevel?: PriorityLevel;
  }>;
}): Promise<ActionResult> {
  try {
    await saveDailyPriorities(input);
    revalidateReviewPaths();
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function saveWeeklyPrioritiesAction(input: {
  weekStartDate: string;
  priorities: Array<{ taskId: string; priorityRank: number }>;
}): Promise<ActionResult> {
  try {
    await saveWeeklyPriorities(input);
    revalidateReviewPaths();
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}
