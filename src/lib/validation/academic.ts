import { z } from "zod";

export const academicTermTypeSchema = z.enum([
  "fall",
  "spring",
  "summer",
  "custom",
]);

export const academicTermStatusSchema = z.enum([
  "draft",
  "active",
  "archived",
]);

export const academicExceptionTypeSchema = z.enum([
  "no_classes",
  "university_closed",
  "break",
  "finals_period",
  "class_cancelled",
  "altered_schedule",
  "custom",
]);

export const academicTermSchema = z.object({
  name: z.string().min(1),
  institution: z.string().default(""),
  termType: academicTermTypeSchema,
  startDate: z.string(),
  endDate: z.string(),
  classesStart: z.string(),
  classesEnd: z.string(),
  finalsStart: z.string().nullable().optional(),
  finalsEnd: z.string().nullable().optional(),
  timezone: z.string().default("America/Chicago"),
  status: academicTermStatusSchema.default("draft"),
});

export const courseSchema = z.object({
  code: z.string().default(""),
  name: z.string().min(1),
  section: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
});

export const classMeetingSchema = z.object({
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  effectiveStartDate: z.string(),
  effectiveEndDate: z.string(),
  location: z.string().nullable().optional(),
  isOnline: z.boolean().default(false),
  timezone: z.string().default("America/Chicago"),
  sourceCanvasUid: z.string().nullable().optional(),
});

export const academicExceptionSchema = z.object({
  exceptionType: academicExceptionTypeSchema,
  startDate: z.string(),
  endDate: z.string(),
  courseId: z.string().uuid().nullable().optional(),
  suppressesClasses: z.boolean().default(false),
  blocksAvailability: z.boolean().default(false),
  informationalOnly: z.boolean().default(false),
  title: z.string().min(1),
  notes: z.string().nullable().optional(),
  alteredSchedule: z.record(z.unknown()).nullable().optional(),
  presetKey: z.string().nullable().optional(),
  isUserModified: z.boolean().default(false),
});

export const semesterSaveSchema = z.object({
  termId: z.string().uuid(),
  removeOmitted: z.boolean().default(false),
});
