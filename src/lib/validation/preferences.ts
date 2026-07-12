import { z } from "zod";

const optionalTime = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/)
  .optional()
  .nullable()
  .or(z.literal(""));

export const planningPreferencesSchema = z
  .object({
    minimumBreakMinutes: z.coerce.number().int().min(0).max(240),
    travelBufferMinutes: z.coerce.number().int().min(0).max(240),
    planningBufferPercent: z.coerce.number().int().min(0).max(80),
    preferredFocusBlockMinutes: z.coerce.number().int().min(15).max(480),
    maximumFocusBlockMinutes: z.coerce.number().int().min(15).max(720),
    dailyNotificationTime: optionalTime,
    weeklyNotificationDay: z.coerce.number().int().min(0).max(6),
    weeklyNotificationTime: optionalTime,
    autoCreateFocusBlocks: z.boolean(),
    avoidDifficultWorkAfter: optionalTime,
    weekStartsOn: z.coerce.number().int().min(0).max(1).optional(),
  })
  .refine(
    (value) =>
      value.maximumFocusBlockMinutes >= value.preferredFocusBlockMinutes,
    {
      message: "Maximum focus block must be at least the preferred length",
      path: ["maximumFocusBlockMinutes"],
    },
  );

export type PlanningPreferencesFormInput = z.infer<
  typeof planningPreferencesSchema
>;

export function normalizeOptionalTime(
  time: string | null | undefined,
): string | null {
  if (!time || time.length === 0) return null;
  return time.length === 5 ? `${time}:00` : time;
}
