import { ConflictError } from "@/lib/errors/app-error";
import {
  assertNoBlockingOverlap,
  getEventById,
  updateEvent,
} from "@/lib/data/events";
import { getEditWorkflow } from "@/lib/calendar/authorization";
import type { EventWithCalendar } from "@/lib/data/events";
import type { ParsedEventTimes } from "@/lib/validation/events";

export type CalendarMutationErrorCode =
  | "read_only"
  | "academic"
  | "canvas"
  | "deadline"
  | "not_allowed";

export class CalendarMutationError extends ConflictError {
  readonly code: CalendarMutationErrorCode;
  readonly workflowUrl: string | null;

  constructor(
    code: CalendarMutationErrorCode,
    message: string,
    workflowUrl: string | null = null,
  ) {
    super(message);
    this.code = code;
    this.workflowUrl = workflowUrl;
  }
}

export function assertCalendarMutationAllowed(event: EventWithCalendar): void {
  const workflow = getEditWorkflow(event);
  switch (workflow) {
    case "read_only":
      throw new CalendarMutationError(
        "read_only",
        "This event is read-only and cannot be changed from the calendar.",
      );
    case "academic":
      throw new CalendarMutationError(
        "academic",
        "School class events are managed on the School page.",
        "/school",
      );
    case "deadline":
      throw new CalendarMutationError(
        "deadline",
        "Deadlines cannot be moved on the calendar. Edit the linked task instead.",
        event.related_task_id ? `/tasks/${event.related_task_id}/edit` : "/tasks",
      );
    default:
      if (event.source === "canvas" || event.calendar_source === "canvas") {
        throw new CalendarMutationError(
          "read_only",
          "Canvas events sync from your LMS and cannot be moved here.",
          "/imports",
        );
      }
      break;
  }
}

export async function movePlanningBlock(
  event: EventWithCalendar,
  parsed: ParsedEventTimes,
): Promise<void> {
  await assertNoBlockingOverlap(parsed.startAt, parsed.endAt);
  await updateEvent(event.id, parsed);
}

export async function moveManualOrWorkEvent(
  event: EventWithCalendar,
  parsed: ParsedEventTimes,
): Promise<void> {
  const workflow = getEditWorkflow(event);
  if (workflow !== "manual" && workflow !== "work_shift") {
    assertCalendarMutationAllowed(event);
  }

  await assertNoBlockingOverlap(parsed.startAt, parsed.endAt);
  await updateEvent(event.id, parsed);
}

export async function routeCalendarMutation(input: {
  eventId: string;
  parsed: ParsedEventTimes;
}): Promise<{ workflow: string }> {
  const event = await getEventById(input.eventId);
  const workflow = getEditWorkflow(event);

  switch (workflow) {
    case "planning_block":
      await movePlanningBlock(event, input.parsed);
      return { workflow };
    case "manual":
    case "work_shift":
      await moveManualOrWorkEvent(event, input.parsed);
      return { workflow };
    case "academic":
    case "deadline":
    case "read_only":
      assertCalendarMutationAllowed(event);
      return { workflow };
    default:
      if (event.source === "canvas" || event.calendar_source === "canvas") {
        throw new CalendarMutationError(
          "read_only",
          "Canvas events sync from your LMS and cannot be moved here.",
          "/imports",
        );
      }
      await moveManualOrWorkEvent(event, input.parsed);
      return { workflow: "manual" };
  }
}
