import { z } from "zod";
import type { ParsedCommand } from "@/lib/assistant/intents";

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);

const showAgendaSchema = z.object({
  intent: z.literal("show_agenda"),
  scope: z.enum(["today", "tomorrow", "date", "week"]),
  dateKey: dateKeySchema.optional(),
});

const showWorkloadSchema = z.object({
  intent: z.literal("show_workload"),
  scope: z.enum(["today", "tomorrow", "date", "week"]),
  dateKey: dateKeySchema.optional(),
});

const findAvailabilitySchema = z.object({
  intent: z.literal("find_availability"),
  durationMinutes: z.number().int().positive().max(480),
  startDateKey: dateKeySchema.optional(),
  endDateKey: dateKeySchema.optional(),
  beforeDateKey: dateKeySchema.optional(),
  timeOfDay: z.enum(["morning", "afternoon", "evening"]).optional(),
});

const generatePlanSchema = z.object({
  intent: z.literal("generate_plan"),
  periodType: z.enum(["day", "week"]),
  weekOffset: z.number().int().optional(),
});

const createEventSchema = z.object({
  intent: z.literal("create_event"),
  title: z.string().min(1).max(500),
  dateKey: dateKeySchema,
  startTime: timeSchema,
  endTime: timeSchema,
  eventType: z.string().optional(),
});

const createTaskSchema = z.object({
  intent: z.literal("create_task"),
  title: z.string().min(1).max(500),
  dueDateKey: dateKeySchema.optional(),
  dueTime: timeSchema.optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  priority: z.number().int().min(1).max(5).optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  splittable: z.boolean().optional(),
  minimumBlockMinutes: z.number().int().min(5).max(480).optional(),
});

const completeTaskSchema = z.object({
  intent: z.literal("complete_task"),
  taskId: z.string().uuid().optional(),
  taskTitle: z.string().min(1).optional(),
});

const proposalSelectionSchema = z.object({
  mode: z.enum(["all", "index", "indices", "period_all"]),
  indices: z.array(z.number().int().positive()).optional(),
  periodType: z.enum(["day", "week"]).optional(),
  weekOffset: z.number().int().optional(),
});

const acceptProposalsSchema = z
  .object({ intent: z.literal("accept_proposals") })
  .merge(proposalSelectionSchema);

const rejectProposalsSchema = z
  .object({ intent: z.literal("reject_proposals") })
  .merge(proposalSelectionSchema);

const regeneratePlanSchema = z.object({
  intent: z.literal("regenerate_plan"),
  periodType: z.enum(["day", "week"]),
  weekOffset: z.number().int().optional(),
});

const workShiftEntrySchema = z.object({
  dateKey: dateKeySchema,
  dayLabel: z.string(),
  isOff: z.boolean(),
  startTime: timeSchema.optional(),
  endTime: timeSchema.optional(),
  isOvernight: z.boolean().optional(),
});

const showWorkScheduleSchema = z.object({
  intent: z.literal("show_work_schedule"),
  scope: z.enum(["week", "next"]),
  weekOffset: z.number().int().optional(),
});

const showWorkHoursSchema = z.object({
  intent: z.literal("show_work_hours"),
  weekOffset: z.number().int().optional(),
});

const setWorkScheduleSchema = z.object({
  intent: z.literal("set_work_schedule"),
  shifts: z.array(workShiftEntrySchema).min(1),
  weekOffset: z.number().int().optional(),
});

const addWorkShiftSchema = z.object({
  intent: z.literal("add_work_shift"),
  dateKey: dateKeySchema,
  startTime: timeSchema.optional(),
  endTime: timeSchema.optional(),
  isOvernight: z.boolean().optional(),
});

const updateWorkShiftSchema = z.object({
  intent: z.literal("update_work_shift"),
  sourceDateKey: dateKeySchema,
  targetDateKey: dateKeySchema.optional(),
  startTime: timeSchema.optional(),
  endTime: timeSchema.optional(),
  isOvernight: z.boolean().optional(),
});

const deleteWorkShiftSchema = z.object({
  intent: z.literal("delete_work_shift"),
  dateKey: dateKeySchema,
});

const copyWorkScheduleSchema = z.object({
  intent: z.literal("copy_work_schedule"),
  sourceWeekOffset: z.number().int(),
  targetWeekOffset: z.number().int(),
});

const helpSchema = z.object({ intent: z.literal("help") });
const clearChatSchema = z.object({ intent: z.literal("clear_chat") });
const unknownSchema = z.object({
  intent: z.literal("unknown"),
  raw: z.string(),
});

export const parsedCommandSchema = z.discriminatedUnion("intent", [
  showAgendaSchema,
  showWorkloadSchema,
  findAvailabilitySchema,
  generatePlanSchema,
  createEventSchema,
  createTaskSchema,
  completeTaskSchema,
  acceptProposalsSchema,
  rejectProposalsSchema,
  regeneratePlanSchema,
  showWorkScheduleSchema,
  showWorkHoursSchema,
  setWorkScheduleSchema,
  addWorkShiftSchema,
  updateWorkShiftSchema,
  deleteWorkShiftSchema,
  copyWorkScheduleSchema,
  helpSchema,
  clearChatSchema,
  unknownSchema,
]);

export function validateParsedCommand(command: ParsedCommand): ParsedCommand {
  return parsedCommandSchema.parse(command);
}

export const assistantMessageSchema = z
  .string()
  .trim()
  .min(1, "Message cannot be empty")
  .max(2000, "Message is too long");
