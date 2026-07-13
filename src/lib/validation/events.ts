import { z } from "zod";
import { EVENT_STATUSES, EVENT_TYPES } from "@/lib/constants";
import {
  toUtcEndOfAppLocalDay,
  toUtcFromAppLocal,
  toUtcFromAppLocalDate,
} from "@/lib/dates/timezone";
import type { EventStatus, EventType } from "@/types/domain";

const eventTypeValues = EVENT_TYPES.map((item) => item.value);

const eventFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(500, "Title is too long"),
  description: z.string().max(5000).optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  calendarId: z.string().uuid("Select a calendar"),
  eventType: z.enum(eventTypeValues as [EventType, ...EventType[]]),
  status: z.enum(EVENT_STATUSES as [EventStatus, ...EventStatus[]]),
  allDay: z.boolean(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Invalid start time")
    .optional(),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Invalid end time")
    .optional(),
});

export type EventFormInput = z.infer<typeof eventFormSchema>;

export type ParsedEventTimes = {
  title: string;
  description: string | null;
  location: string | null;
  calendarId: string;
  eventType: EventType;
  status: EventStatus;
  allDay: boolean;
  startAt: string;
  endAt: string;
};

export function parseEventForm(input: EventFormInput): ParsedEventTimes {
  const parsed = eventFormSchema.parse(input);

  if (!parsed.allDay) {
    if (!parsed.startTime) {
      throw new z.ZodError([
        {
          code: "custom",
          message: "Start time is required",
          path: ["startTime"],
        },
      ]);
    }
    if (!parsed.endTime) {
      throw new z.ZodError([
        {
          code: "custom",
          message: "End time is required",
          path: ["endTime"],
        },
      ]);
    }
  }

  try {
    if (parsed.allDay) {
      const startAt = toUtcFromAppLocalDate(parsed.date);
      const endAt = toUtcEndOfAppLocalDay(parsed.date);
      if (endAt <= startAt) {
        throw new Error("End must be after start");
      }
      return {
        title: parsed.title,
        description: parsed.description?.trim() || null,
        location: parsed.location?.trim() || null,
        calendarId: parsed.calendarId,
        eventType: parsed.eventType,
        status: parsed.status,
        allDay: true,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      };
    }

    const startAt = toUtcFromAppLocal(parsed.date, parsed.startTime!);
    const endAt = toUtcFromAppLocal(parsed.date, parsed.endTime!);

    if (endAt <= startAt) {
      throw new Error("End time must be after start time");
    }

    return {
      title: parsed.title,
      description: parsed.description?.trim() || null,
      location: parsed.location?.trim() || null,
      calendarId: parsed.calendarId,
      eventType: parsed.eventType,
      status: parsed.status,
      allDay: false,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw error;
    }
    throw new z.ZodError([
      {
        code: "custom",
        message:
          error instanceof Error
            ? error.message
            : "Invalid date or time in America/Chicago",
        path: ["startTime"],
      },
    ]);
  }
}

export function parseEventTimesFromIso(input: {
  startAt: string;
  endAt: string;
  allDay: boolean;
  title: string;
  description: string | null;
  location: string | null;
  calendarId: string;
  eventType: EventType;
  status: EventStatus;
}): ParsedEventTimes {
  const start = new Date(input.startAt);
  const end = new Date(input.endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Invalid date/time");
  }
  if (end <= start) {
    throw new Error("End time must be after start time");
  }
  return {
    title: input.title,
    description: input.description,
    location: input.location,
    calendarId: input.calendarId,
    eventType: input.eventType,
    status: input.status,
    allDay: input.allDay,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  };
}

export const dateRangeQuerySchema = z
  .object({
    start: z.string().min(1),
    end: z.string().min(1),
  })
  .refine(
    (value) => new Date(value.end) > new Date(value.start),
    "End must be after start",
  );
