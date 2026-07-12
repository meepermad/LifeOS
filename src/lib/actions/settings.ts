"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import {
  createAvailabilityRule,
  deleteAvailabilityRule,
  toggleAvailabilityRule,
  updateAvailabilityRule,
} from "@/lib/data/availability";
import { updateCalendarVisibility } from "@/lib/data/calendars";
import { updatePlanningPreferences } from "@/lib/data/preferences";
import { updateProfileSettings } from "@/lib/data/bootstrap";
import type { AvailabilityFormInput } from "@/lib/validation/availability";
import type { PlanningPreferencesFormInput } from "@/lib/validation/preferences";
import { AppError } from "@/lib/errors/app-error";

export type ActionResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

function toActionError(error: unknown): ActionResult {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      fieldErrors[issue.path.join(".") || "form"] = issue.message;
    }
    return { success: false, error: "Validation failed", fieldErrors };
  }
  if (error instanceof AppError) {
    return { success: false, error: error.message };
  }
  return { success: false, error: "An unexpected error occurred" };
}

export async function updateProfileAction(weekStartsOn: 0 | 1): Promise<ActionResult> {
  try {
    await updateProfileSettings({ weekStartsOn });
    revalidatePath("/settings");
    revalidatePath("/week");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updatePlanningPreferencesAction(
  input: PlanningPreferencesFormInput,
): Promise<ActionResult> {
  try {
    await updatePlanningPreferences(input);
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createAvailabilityRuleAction(
  input: AvailabilityFormInput,
): Promise<ActionResult> {
  try {
    await createAvailabilityRule(input);
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateAvailabilityRuleAction(
  ruleId: string,
  input: AvailabilityFormInput,
): Promise<ActionResult> {
  try {
    await updateAvailabilityRule(ruleId, input);
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function toggleAvailabilityRuleAction(
  ruleId: string,
  isEnabled: boolean,
): Promise<ActionResult> {
  try {
    await toggleAvailabilityRule(ruleId, isEnabled);
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteAvailabilityRuleAction(
  ruleId: string,
): Promise<ActionResult> {
  try {
    await deleteAvailabilityRule(ruleId);
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateCalendarVisibilityAction(
  calendarId: string,
  isVisible: boolean,
): Promise<ActionResult> {
  try {
    await updateCalendarVisibility(calendarId, isVisible);
    revalidatePath("/settings");
    revalidatePath("/week");
    revalidatePath("/today");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}
