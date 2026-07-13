"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors/app-error";
import {
  createManualEntry,
  deleteTimeEntry,
  discardTimer,
  getActiveTimer,
  pauseTimer,
  resumeTimer,
  startTimer,
  stopTimer,
  switchTimer,
} from "@/lib/data/time-entries";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

function toActionError<T = void>(error: unknown): ActionResult<T> {
  if (error instanceof AppError) {
    return { success: false, error: error.message };
  }
  return { success: false, error: "An unexpected error occurred" };
}

function revalidateTimerPaths() {
  revalidatePath("/today");
  revalidatePath("/calendar");
  revalidatePath("/tasks");
  revalidatePath("/chat");
}

export async function getActiveTimerAction() {
  try {
    const timer = await getActiveTimer();
    return { success: true as const, data: timer };
  } catch (error) {
    return toActionError(error);
  }
}

export async function startTimerAction(taskId: string) {
  try {
    const data = await startTimer(taskId);
    revalidateTimerPaths();
    return { success: true as const, data };
  } catch (error) {
    return toActionError(error);
  }
}

export async function pauseTimerAction() {
  try {
    const data = await pauseTimer();
    revalidateTimerPaths();
    return { success: true as const, data };
  } catch (error) {
    return toActionError(error);
  }
}

export async function resumeTimerAction() {
  try {
    const data = await resumeTimer();
    revalidateTimerPaths();
    return { success: true as const, data };
  } catch (error) {
    return toActionError(error);
  }
}

export async function stopTimerAction(endedAt?: string) {
  try {
    const data = await stopTimer(endedAt);
    revalidateTimerPaths();
    return { success: true as const, data };
  } catch (error) {
    return toActionError(error);
  }
}

export async function discardTimerAction() {
  try {
    await discardTimer();
    revalidateTimerPaths();
    return { success: true as const };
  } catch (error) {
    return toActionError(error);
  }
}

export async function switchTimerAction(taskId: string) {
  try {
    const data = await switchTimer(taskId);
    revalidateTimerPaths();
    return { success: true as const, data };
  } catch (error) {
    return toActionError(error);
  }
}

export async function logManualTimeAction(input: {
  taskId: string;
  startedAt: string;
  endedAt: string;
  note?: string | null;
}) {
  try {
    const data = await createManualEntry(input);
    revalidateTimerPaths();
    revalidatePath("/insights");
    return { success: true as const, data };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteTimeEntryAction(entryId: string) {
  try {
    await deleteTimeEntry(entryId);
    revalidateTimerPaths();
    revalidatePath("/insights");
    return { success: true as const };
  } catch (error) {
    return toActionError(error);
  }
}
