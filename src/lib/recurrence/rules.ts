import { z } from "zod";
import type { RecurrenceRule } from "@/lib/recurrence/types";

const recurrenceRuleSchema = z.discriminatedUnion("frequency", [
  z.object({
    frequency: z.literal("daily"),
    interval: z.number().int().min(1).max(365).optional().default(1),
  }),
  z.object({
    frequency: z.literal("weekdays"),
  }),
  z.object({
    frequency: z.literal("weekly"),
    interval: z.number().int().min(1).max(52).optional().default(1),
    byWeekday: z.array(z.number().int().min(0).max(6)).min(1),
  }),
  z.object({
    frequency: z.literal("monthly"),
    monthlyMode: z.enum(["day_of_month", "ordinal_weekday"]),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    ordinal: z.number().int().min(-5).max(5).optional(),
    weekday: z.number().int().min(0).max(6).optional(),
    interval: z.number().int().min(1).max(12).optional().default(1),
  }),
  z.object({
    frequency: z.literal("yearly"),
    month: z.number().int().min(1).max(12),
    dayOfMonth: z.number().int().min(1).max(31),
    interval: z.number().int().min(1).max(10).optional().default(1),
  }),
  z.object({
    frequency: z.literal("custom"),
    intervalDays: z.number().int().min(1).max(365),
  }),
]);

export function parseRecurrenceRule(input: unknown): RecurrenceRule {
  return recurrenceRuleSchema.parse(input) as RecurrenceRule;
}

export function describeRecurrenceRule(rule: RecurrenceRule): string {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  switch (rule.frequency) {
    case "daily":
      return rule.interval && rule.interval > 1
        ? `Every ${rule.interval} days`
        : "Daily";
    case "weekdays":
      return "Weekdays";
    case "weekly": {
      const days = (rule.byWeekday ?? []).map((d) => dayNames[d]).join(", ");
      const interval = rule.interval ?? 1;
      return interval > 1
        ? `Every ${interval} weeks on ${days}`
        : `Weekly on ${days}`;
    }
    case "monthly":
      if (rule.monthlyMode === "ordinal_weekday") {
        const ord =
          rule.ordinal === -1
            ? "last"
            : rule.ordinal === 1
              ? "first"
              : rule.ordinal === 2
                ? "second"
                : rule.ordinal === 3
                  ? "third"
                  : rule.ordinal === 4
                    ? "fourth"
                    : `${rule.ordinal}th`;
        return `The ${ord} ${dayNames[rule.weekday ?? 0]} of every month`;
      }
      return `Day ${rule.dayOfMonth} of every month`;
    case "yearly":
      return `Every year on month ${rule.month}/${rule.dayOfMonth}`;
    case "custom":
      return `Every ${rule.intervalDays} days`;
    default:
      return "Custom recurrence";
  }
}
