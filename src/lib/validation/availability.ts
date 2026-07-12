import { z } from "zod";

const timePattern = /^\d{2}:\d{2}(:\d{2})?$/;

export const availabilityFormSchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    availableStart: z.string().regex(timePattern, "Invalid start time"),
    availableEnd: z.string().regex(timePattern, "Invalid end time"),
    maximumFocusMinutes: z.coerce
      .number()
      .int()
      .min(15)
      .max(1440)
      .optional()
      .nullable(),
    preferredBlockMinutes: z.coerce
      .number()
      .int()
      .min(15)
      .max(480)
      .optional()
      .nullable(),
    isEnabled: z.boolean().default(true),
  })
  .refine(
    (value) => value.availableEnd > value.availableStart,
    {
      message: "End time must be after start time",
      path: ["availableEnd"],
    },
  );

export type AvailabilityFormInput = z.infer<typeof availabilityFormSchema>;

export function normalizeTimeForDb(time: string): string {
  return time.length === 5 ? `${time}:00` : time;
}
