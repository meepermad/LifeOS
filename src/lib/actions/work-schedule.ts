"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { z } from "zod";
import { getProfile } from "@/lib/data/bootstrap";
import { listEventsInRange } from "@/lib/data/events";
import {
  applyWorkShiftReconciliation,
  eventToShiftDayDraft,
  listWorkShiftsInRange,
} from "@/lib/data/work-shifts";
import {
  createWorkShiftTemplate,
  deleteWorkShiftTemplate,
  listWorkShiftTemplates,
  updateWorkShiftTemplate,
} from "@/lib/data/work-templates";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { AppError } from "@/lib/errors/app-error";
import { getWeekBounds, getWeekDayKeys } from "@/lib/dates/timezone";
import { addAppDays } from "@/lib/dates/timezone";
import type { ShiftDayDraft } from "@/lib/work/shift-draft";
import { detectShiftConflicts } from "@/lib/work/shift-conflicts";
import { reconcileWeeklyShifts } from "@/lib/work/shift-reconciliation";
import { formatShiftPreviewList } from "@/lib/work/shift-preview";
import { parseWeeklyDraft } from "@/lib/work/shift-validation";
import { calculateWorkHours } from "@/lib/work/work-hours";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

const shiftDaySchema = z.object({
  dateKey: z.string(),
  isOff: z.boolean(),
  startTime: z.string(),
  endTime: z.string(),
  unpaidBreakMinutes: z.number().int().min(0).max(479),
  location: z.string(),
  note: z.string(),
  eventId: z.string().optional(),
});

const previewSchema = z.object({
  weekStartKey: z.string(),
  days: z.array(shiftDaySchema),
});

const saveSchema = previewSchema.extend({
  removeOmitted: z.boolean(),
  confirmLongShifts: z.boolean().optional(),
});

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
  if (error instanceof Error) {
    return { success: false, error: error.message };
  }
  return { success: false, error: "An unexpected error occurred" };
}

export type WorkSchedulePreview = {
  previewText: string;
  conflicts: { shiftDateKey: string; message: string }[];
  omitted: { eventId: string; dateKey: string; startAt: string; endAt: string }[];
  summary: {
    created: number;
    updated: number;
    unchanged: number;
    removed: number;
  };
  requiresLongShiftConfirmation: boolean;
};

export async function previewWorkScheduleAction(
  input: z.infer<typeof previewSchema>,
): Promise<ActionResult<WorkSchedulePreview>> {
  try {
    await requireAllowedUser();
    const parsed = previewSchema.parse(input);
    const profile = await getProfile();
    const { shifts, errors } = parseWeeklyDraft(parsed.days, profile.timezone);

    if (errors.length > 0) {
      return { success: false, error: errors[0]?.message ?? "Invalid shift data" };
    }

    const weekBounds = getWeekBounds(
      new Date(`${parsed.weekStartKey}T12:00:00Z`),
      profile.week_starts_on as 0 | 1,
    );
    const existingShifts = await listWorkShiftsInRange(
      weekBounds.start.toISOString(),
      weekBounds.end.toISOString(),
    );
    const { items, omitted } = reconcileWeeklyShifts({
      draftShifts: shifts,
      existingShifts,
      removeOmitted: false,
    });

    const allEvents = await listEventsInRange(
      weekBounds.start.toISOString(),
      weekBounds.end.toISOString(),
    );
    const conflicts = detectShiftConflicts(shifts, allEvents);

    const summary = {
      created: items.filter((i) => i.action === "created").length,
      updated: items.filter((i) => i.action === "updated").length,
      unchanged: items.filter((i) => i.action === "unchanged").length,
      removed: 0,
    };

    return {
      success: true,
      data: {
        previewText: formatShiftPreviewList(shifts),
        conflicts,
        omitted,
        summary,
        requiresLongShiftConfirmation: shifts.some((s) => s.requiresConfirmation),
      },
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function saveWorkScheduleAction(
  input: z.infer<typeof saveSchema>,
): Promise<
  ActionResult<{
    created: number;
    updated: number;
    unchanged: number;
    removed: number;
    conflicts: number;
  }>
> {
  try {
    await requireAllowedUser();
    const parsed = saveSchema.parse(input);
    const profile = await getProfile();
    const { shifts, errors } = parseWeeklyDraft(parsed.days, profile.timezone);

    if (errors.length > 0) {
      return { success: false, error: errors[0]?.message ?? "Invalid shift data" };
    }

    if (
      shifts.some((s) => s.requiresConfirmation) &&
      !parsed.confirmLongShifts
    ) {
      return {
        success: false,
        error: "Please confirm shifts longer than 12 hours before saving.",
      };
    }

    const weekBounds = getWeekBounds(
      new Date(`${parsed.weekStartKey}T12:00:00Z`),
      profile.week_starts_on as 0 | 1,
    );
    const existingShifts = await listWorkShiftsInRange(
      weekBounds.start.toISOString(),
      weekBounds.end.toISOString(),
    );
    const { items } = reconcileWeeklyShifts({
      draftShifts: shifts,
      existingShifts,
      removeOmitted: parsed.removeOmitted,
    });

    const allEvents = await listEventsInRange(
      weekBounds.start.toISOString(),
      weekBounds.end.toISOString(),
    );
    const conflicts = detectShiftConflicts(shifts, allEvents);

    const result = await applyWorkShiftReconciliation(items);

    revalidatePath("/work");
    revalidatePath("/today");
    revalidatePath("/week");

    return {
      success: true,
      data: { ...result, conflicts: conflicts.length },
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function getWorkHoursSummaryAction(weekOffset = 0) {
  try {
    await requireAllowedUser();
    const profile = await getProfile();
    const bounds = getWeekBounds(new Date(), profile.week_starts_on as 0 | 1, weekOffset);
    const shifts = await listWorkShiftsInRange(
      bounds.start.toISOString(),
      bounds.end.toISOString(),
    );
    return { success: true as const, data: calculateWorkHours(shifts) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function copyPreviousWeekDraftAction(
  weekStartKey: string,
): Promise<ActionResult<{ days: ShiftDayDraft[] }>> {
  try {
    await requireAllowedUser();
    const profile = await getProfile();
    const prevWeekStart = addAppDays(weekStartKey, -7);
    const prevBounds = getWeekBounds(
      new Date(`${prevWeekStart}T12:00:00Z`),
      profile.week_starts_on as 0 | 1,
    );
    const prevShifts = await listWorkShiftsInRange(
      prevBounds.start.toISOString(),
      prevBounds.end.toISOString(),
    );

    const dayKeys = getWeekDayKeys(
      new Date(`${weekStartKey}T12:00:00Z`),
      profile.week_starts_on as 0 | 1,
    );

    const days: ShiftDayDraft[] = dayKeys.map((dateKey) => {
      const prevDateKey = addAppDays(dateKey, -7);
      const prevShift = prevShifts.find(
        (s) =>
          s.external_event_id === `work-shift:${prevDateKey}` ||
          s.start_at.startsWith(prevDateKey),
      );

      if (!prevShift) {
        return {
          dateKey,
          isOff: true,
          startTime: "",
          endTime: "",
          unpaidBreakMinutes: 0,
          location: "",
          note: "",
        };
      }

      const draft = eventToShiftDayDraft(prevShift);
      return {
        ...draft,
        dateKey,
        eventId: undefined,
      };
    });
    return { success: true, data: { days } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function listTemplatesAction() {
  try {
    await requireAllowedUser();
    const templates = await listWorkShiftTemplates();
    return { success: true as const, data: templates };
  } catch (error) {
    return toActionError(error);
  }
}

export async function saveTemplateAction(input: {
  id?: string;
  name: string;
  startTime: string;
  endTime: string;
  unpaidBreakMinutes?: number;
  location?: string;
  label?: string;
}) {
  try {
    await requireAllowedUser();
    const data = input.id
      ? await updateWorkShiftTemplate(input.id, input)
      : await createWorkShiftTemplate(input);
    revalidatePath("/work");
    return { success: true as const, data };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteTemplateAction(templateId: string) {
  try {
    await requireAllowedUser();
    await deleteWorkShiftTemplate(templateId);
    revalidatePath("/work");
    return { success: true as const };
  } catch (error) {
    return toActionError(error);
  }
}
