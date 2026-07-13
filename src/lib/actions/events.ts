"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import {
  createEvent,
  deleteEvent,
  updateEvent,
} from "@/lib/data/events";
import { parseEventForm, type EventFormInput } from "@/lib/validation/events";
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

export async function createEventAction(
  input: EventFormInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = parseEventForm(input);
    const event = await createEvent(parsed);
    revalidatePath("/calendar");
    revalidatePath("/today");
    revalidatePath("/week");
    return { success: true, data: { id: event.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateEventAction(
  eventId: string,
  input: EventFormInput,
): Promise<ActionResult> {
  try {
    const parsed = parseEventForm(input);
    await updateEvent(eventId, parsed);
    revalidatePath("/calendar");
    revalidatePath("/today");
    revalidatePath("/week");
    revalidatePath(`/events/${eventId}/edit`);
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteEventAction(eventId: string): Promise<ActionResult> {
  try {
    await deleteEvent(eventId);
    revalidatePath("/calendar");
    revalidatePath("/today");
    revalidatePath("/week");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}
