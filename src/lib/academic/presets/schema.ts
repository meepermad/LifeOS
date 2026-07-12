import { z } from "zod";
import { academicExceptionTypeSchema, academicTermTypeSchema } from "@/lib/validation/academic";

export const presetExceptionSchema = z.object({
  key: z.string(),
  exceptionType: academicExceptionTypeSchema,
  startDate: z.string(),
  endDate: z.string(),
  title: z.string(),
  suppressesClasses: z.boolean().default(false),
  blocksAvailability: z.boolean().default(false),
  informationalOnly: z.boolean().default(false),
});

export const presetTermSchema = z.object({
  key: z.string(),
  name: z.string(),
  institution: z.string(),
  termType: academicTermTypeSchema,
  startDate: z.string(),
  endDate: z.string(),
  classesStart: z.string(),
  classesEnd: z.string(),
  finalsStart: z.string().nullable().optional(),
  finalsEnd: z.string().nullable().optional(),
  timezone: z.string().default("America/Chicago"),
  exceptions: z.array(presetExceptionSchema).default([]),
});

export const academicPresetSchema = z.object({
  key: z.string(),
  name: z.string(),
  institution: z.string(),
  sourceUrl: z.string(),
  sourcePdfUrl: z.string().optional(),
  revisionDate: z.string(),
  terms: z.array(presetTermSchema),
});

export type AcademicPreset = z.infer<typeof academicPresetSchema>;
export type PresetTerm = z.infer<typeof presetTermSchema>;
export type PresetException = z.infer<typeof presetExceptionSchema>;
