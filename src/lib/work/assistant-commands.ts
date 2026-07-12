import type { ParsedCommand } from "@/lib/assistant/intents";
import { getProfile } from "@/lib/data/bootstrap";
import { listEventsInRange } from "@/lib/data/events";
import { eventToShiftDayDraft } from "@/lib/data/work-shifts";
import {
  applyWorkShiftReconciliation,
  cancelWorkShiftByDate,
  listWorkShiftsInRange,
} from "@/lib/data/work-shifts";
import { getWeekBounds } from "@/lib/dates/timezone";
import { addAppDays } from "@/lib/dates/timezone";
import { formatAppDate, formatAppTimeRange } from "@/lib/dates/timezone";
import type { ShiftDayDraft } from "@/lib/work/shift-draft";
import { detectShiftConflicts } from "@/lib/work/shift-conflicts";
import { reconcileWeeklyShifts } from "@/lib/work/shift-reconciliation";
import { formatShiftPreviewList } from "@/lib/work/shift-preview";
import { parseShiftDay, type ParsedShift } from "@/lib/work/shift-validation";
import {
  calculateWorkHours,
  formatWorkHoursSpoken,
} from "@/lib/work/work-hours";

export function commandToShiftDraft(
  command: Extract<ParsedCommand, { intent: "add_work_shift" }>,
): ShiftDayDraft {
  return {
    dateKey: command.dateKey,
    isOff: false,
    startTime: command.startTime ?? "",
    endTime: command.endTime ?? "",
    unpaidBreakMinutes: 0,
    location: "",
    note: "",
  };
}

export function commandsToWeeklyDraft(
  shifts: Extract<ParsedCommand, { intent: "set_work_schedule" }>["shifts"],
): ShiftDayDraft[] {
  return shifts.map((shift) =>
    shift.isOff
      ? {
          dateKey: shift.dateKey,
          isOff: true,
          startTime: "",
          endTime: "",
          unpaidBreakMinutes: 0,
          location: "",
          note: "",
        }
      : {
          dateKey: shift.dateKey,
          isOff: false,
          startTime: shift.startTime ?? "",
          endTime: shift.endTime ?? "",
          unpaidBreakMinutes: 0,
          location: "",
          note: "",
        },
  );
}

export async function buildShiftsFromCommand(
  command: ParsedCommand,
): Promise<{ shifts: ParsedShift[]; errors: string[] }> {
  const profile = await getProfile();
  const errors: string[] = [];
  const shifts: ParsedShift[] = [];

  if (command.intent === "add_work_shift") {
    const result = parseShiftDay(commandToShiftDraft(command), profile.timezone);
    if (result.error) errors.push(result.error.message);
    else if (result.shift) shifts.push(result.shift);
  }

  if (command.intent === "set_work_schedule") {
    const parsed = commandsToWeeklyDraft(command.shifts);
    for (const day of parsed) {
      const result = parseShiftDay(day, profile.timezone);
      if (result.error) errors.push(result.error.message);
      else if (result.shift) shifts.push(result.shift);
    }
  }

  if (command.intent === "update_work_shift" && command.startTime && command.endTime) {
    const result = parseShiftDay(
      {
        dateKey: command.targetDateKey ?? command.sourceDateKey,
        isOff: false,
        startTime: command.startTime,
        endTime: command.endTime,
        unpaidBreakMinutes: 0,
        location: "",
        note: "",
      },
      profile.timezone,
    );
    if (result.error) errors.push(result.error.message);
    else if (result.shift) shifts.push(result.shift);
  }

  return { shifts, errors };
}

export async function getWorkScheduleResponse(
  command: Extract<ParsedCommand, { intent: "show_work_schedule" }>,
) {
  const profile = await getProfile();

  if (command.scope === "next") {
    const bounds = getWeekBounds(new Date(), profile.week_starts_on as 0 | 1, 0);
    const shifts = await listWorkShiftsInRange(
      new Date().toISOString(),
      bounds.end.toISOString(),
    );
    const upcoming = shifts.find((s) => new Date(s.start_at) >= new Date());
    if (!upcoming) {
      return "You have no upcoming work shifts scheduled.";
    }
    return `Your next shift is ${formatAppDate(upcoming.start_at)} from ${formatAppTimeRange(upcoming.start_at, upcoming.end_at)}.`;
  }

  const weekOffset = command.weekOffset ?? 0;
  const bounds = getWeekBounds(new Date(), profile.week_starts_on as 0 | 1, weekOffset);
  const shifts = await listWorkShiftsInRange(
    bounds.start.toISOString(),
    bounds.end.toISOString(),
  );

  if (shifts.length === 0) {
    return weekOffset === 1
      ? "You have no work shifts scheduled next week."
      : "You have no work shifts scheduled this week.";
  }

  return formatShiftPreviewList(
    shifts.map((event) => ({
      dateKey: event.start_at.slice(0, 10),
      startAt: event.start_at,
      endAt: event.end_at,
      isOvernight: event.end_at.slice(0, 10) !== event.start_at.slice(0, 10),
      unpaidBreakMinutes: event.unpaid_break_minutes ?? 0,
      location: event.location,
      note: event.shift_note,
      title: event.title,
      requiresConfirmation: false,
    })),
  );
}

export async function getWorkHoursResponse(
  command: Extract<ParsedCommand, { intent: "show_work_hours" }>,
) {
  const profile = await getProfile();
  const weekOffset = command.weekOffset ?? 0;
  const bounds = getWeekBounds(new Date(), profile.week_starts_on as 0 | 1, weekOffset);
  const shifts = await listWorkShiftsInRange(
    bounds.start.toISOString(),
    bounds.end.toISOString(),
  );
  return formatWorkHoursSpoken(calculateWorkHours(shifts));
}

export async function previewWorkCommand(command: ParsedCommand) {
  const profile = await getProfile();

  if (command.intent === "delete_work_shift") {
    const bounds = getWeekBounds(new Date(), profile.week_starts_on as 0 | 1, 0);
    const existing = await listWorkShiftsInRange(
      bounds.start.toISOString(),
      bounds.end.toISOString(),
    );
    const event = existing.find(
      (s) =>
        s.external_event_id === `work-shift:${command.dateKey}` ||
        s.start_at.startsWith(command.dateKey),
    );
    return {
      content: `Remove work shift on ${formatAppDate(`${command.dateKey}T12:00:00Z`)}.`,
      shifts: [] as ParsedShift[],
      items: event
        ? [{ dateKey: command.dateKey, action: "removed" as const, eventId: event.id }]
        : [],
    };
  }

  if (
    command.intent === "update_work_shift" &&
    command.targetDateKey &&
    !command.startTime
  ) {
    const sourceBounds = getWeekBounds(new Date(), profile.week_starts_on as 0 | 1, 0);
    const existing = await listWorkShiftsInRange(
      sourceBounds.start.toISOString(),
      sourceBounds.end.toISOString(),
    );
    const source = existing.find(
      (s) =>
        s.external_event_id === `work-shift:${command.sourceDateKey}` ||
        s.start_at.startsWith(command.sourceDateKey),
    );
    if (!source) {
      throw new Error("Could not find the shift to move.");
    }
    const draft = eventToShiftDayDraft(source);
    const result = parseShiftDay(
      { ...draft, dateKey: command.targetDateKey, eventId: undefined },
      profile.timezone,
    );
    if (!result.shift) {
      throw new Error("Could not build the moved shift.");
    }
    return {
      content: `Move shift from ${command.sourceDateKey} to ${command.targetDateKey}.`,
      shifts: [result.shift],
      items: [
        { dateKey: command.sourceDateKey, action: "removed" as const, eventId: source.id },
        { dateKey: command.targetDateKey, action: "created" as const, shift: result.shift },
      ],
    };
  }

  if (command.intent === "copy_work_schedule") {
    const sourceBounds = getWeekBounds(
      new Date(),
      profile.week_starts_on as 0 | 1,
      command.sourceWeekOffset,
    );
    const sourceShifts = await listWorkShiftsInRange(
      sourceBounds.start.toISOString(),
      sourceBounds.end.toISOString(),
    );

    const dayOffset = (command.targetWeekOffset - command.sourceWeekOffset) * 7;
    const shifts: ParsedShift[] = [];

    for (const event of sourceShifts) {
      const draft = eventToShiftDayDraft(event);
      const targetDateKey = addAppDays(draft.dateKey, dayOffset);
      const result = parseShiftDay(
        { ...draft, dateKey: targetDateKey, eventId: undefined },
        profile.timezone,
      );
      if (result.shift) shifts.push(result.shift);
    }

    return {
      content: `Copy ${shifts.length} shift(s) to the target week.`,
      shifts,
      items: shifts.map((shift) => ({
        dateKey: shift.dateKey,
        action: "created" as const,
        shift,
      })),
    };
  }

  const { shifts, errors } = await buildShiftsFromCommand(command);
  if (errors.length > 0) {
    throw new Error(errors[0]);
  }

  const minDate = shifts.map((s) => s.dateKey).sort()[0];
  const maxDate = shifts.map((s) => s.dateKey).sort().at(-1);
  const bounds = {
    start: new Date(`${minDate}T00:00:00Z`),
    end: new Date(`${maxDate}T23:59:59Z`),
  };

  const existingShifts = await listWorkShiftsInRange(
    bounds.start.toISOString(),
    bounds.end.toISOString(),
  );

  const { items } = reconcileWeeklyShifts({
    draftShifts: shifts,
    existingShifts,
    removeOmitted: false,
  });

  const allEvents = await listEventsInRange(
    bounds.start.toISOString(),
    bounds.end.toISOString(),
  );
  const conflicts = detectShiftConflicts(shifts, allEvents);

  let content = formatShiftPreviewList(shifts);
  if (conflicts.length > 0) {
    content += `\n\nConflicts:\n${conflicts.map((c) => `• ${c.message}`).join("\n")}`;
  }

  return { content, shifts, items };
}

export async function executeWorkCommand(
  command: ParsedCommand,
  options?: { assistantActionId?: string },
) {
  if (command.intent === "delete_work_shift") {
    await cancelWorkShiftByDate(command.dateKey);
    return `Removed work shift on ${formatAppDate(`${command.dateKey}T12:00:00Z`)}.`;
  }

  const preview = await previewWorkCommand(command);
  const result = await applyWorkShiftReconciliation(preview.items, {
    assistantActionId: options?.assistantActionId,
    createdByAssistant: true,
  });

  return `Work schedule updated. Created ${result.created}, updated ${result.updated}, removed ${result.removed}.`;
}
