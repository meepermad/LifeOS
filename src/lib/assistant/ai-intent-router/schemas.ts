import { z } from "zod";
import { ALLOWED_RANGE_KINDS } from "./allowlist";

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);

export const intentRouterRangeSchema = z
  .object({
    kind: z.enum([...ALLOWED_RANGE_KINDS] as [string, ...string[]]),
    offset: z.number().int().nullable().optional(),
    startDate: dateKeySchema.nullable().optional(),
    endDate: dateKeySchema.nullable().optional(),
  })
  .strict();

export const intentRouterResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    status: z.enum(["matched", "clarification_required", "unsupported"]),
    intent: z.string(),
    confidence: z.number().min(0).max(1),
    range: intentRouterRangeSchema.nullable(),
    entities: z.record(z.unknown()),
    clarificationQuestion: z.string().nullable(),
  })
  .strict();

export type ValidatedIntentRouterResult = z.infer<typeof intentRouterResultSchema>;

const FORBIDDEN_ENTITY_KEYS = new Set([
  "userId",
  "user_id",
  "actionId",
  "action_id",
  "confirmed",
  "owner",
  "user",
  "shortcutToken",
  "shortcut_token",
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateIntentRouterResult(
  raw: unknown,
  allowedIntents: readonly string[],
): { ok: true; data: ValidatedIntentRouterResult } | { ok: false; reason: string } {
  const parsed = intentRouterResultSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: "schema_invalid" };
  }

  const data = parsed.data;

  if (
    data.status === "matched" &&
    !allowedIntents.includes(data.intent)
  ) {
    return { ok: false, reason: "unknown_intent" };
  }

  if (data.status === "matched" && data.intent === "unsupported") {
    return { ok: false, reason: "unsupported_intent" };
  }

  if (data.status === "clarification_required" && !data.clarificationQuestion?.trim()) {
    return { ok: false, reason: "missing_clarification" };
  }

  for (const [key, value] of Object.entries(data.entities)) {
    if (FORBIDDEN_ENTITY_KEYS.has(key)) {
      return { ok: false, reason: "forbidden_entity" };
    }
    if (typeof value === "string" && UUID_PATTERN.test(value)) {
      return { ok: false, reason: "arbitrary_uuid" };
    }
  }

  if (data.range?.startDate && data.range?.endDate) {
    if (data.range.endDate < data.range.startDate) {
      return { ok: false, reason: "invalid_date_range" };
    }
  }

  return { ok: true, data };
}

export const writeEntitySchemas = {
  create_event: z
    .object({
      title: z.string().min(1).max(500),
      dateKey: dateKeySchema.optional(),
      startTime: timeSchema.optional(),
      endTime: timeSchema.optional(),
      eventType: z.string().optional(),
    })
    .strict(),
  create_task: z
    .object({
      title: z.string().min(1).max(500),
      dueDateKey: dateKeySchema.optional(),
      dueTime: timeSchema.optional(),
      estimatedMinutes: z.number().int().positive().optional(),
      priority: z.number().int().min(1).max(5).optional(),
    })
    .strict(),
  add_work_shift: z
    .object({
      dateKey: dateKeySchema.optional(),
      startTime: timeSchema.optional(),
      endTime: timeSchema.optional(),
      isOvernight: z.boolean().optional(),
    })
    .strict(),
  update_work_shift: z
    .object({
      sourceDateKey: dateKeySchema.optional(),
      targetDateKey: dateKeySchema.optional(),
      startTime: timeSchema.optional(),
      endTime: timeSchema.optional(),
      isOvernight: z.boolean().optional(),
    })
    .strict(),
  delete_work_shift: z
    .object({
      dateKey: dateKeySchema.optional(),
    })
    .strict(),
};
