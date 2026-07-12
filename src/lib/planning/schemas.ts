import { z } from "zod";

export const workloadPeriodSchema = z.object({
  periodType: z.enum(["day", "week"]),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
});

export const canvasDeadlineTaskSchema = z.object({
  eventId: z.string().uuid(),
  estimatedMinutes: z.coerce.number().int().min(1, "Estimate is required"),
  priority: z.coerce.number().int().min(1).max(5).optional(),
  difficulty: z.coerce.number().int().min(1).max(5).optional(),
  earliestStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  earliestStartTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  splittable: z.boolean().optional(),
  minimumBlockMinutes: z.coerce.number().int().min(5).max(480).optional(),
});

export type CanvasDeadlineTaskInput = z.infer<typeof canvasDeadlineTaskSchema>;
