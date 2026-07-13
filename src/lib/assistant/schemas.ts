import { z } from "zod";
import type { ParsedCommand } from "@/lib/assistant/intents";

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);

const dateRangeRefSchema = z.object({
  phrase: z.string(),
  startDateKey: dateKeySchema,
  endDateKey: dateKeySchema,
  label: z.string(),
});

const showAgendaSchema = z.object({
  intent: z.literal("show_agenda"),
  scope: z.enum(["today", "tomorrow", "date", "week", "range"]),
  dateKey: dateKeySchema.optional(),
  range: dateRangeRefSchema.optional(),
});

const showWorkloadSchema = z.object({
  intent: z.literal("show_workload"),
  scope: z.enum(["today", "tomorrow", "date", "week", "range"]),
  dateKey: dateKeySchema.optional(),
  range: dateRangeRefSchema.optional(),
});

const scheduleSummarySchema = z.object({
  intent: z.literal("schedule_summary"),
  range: dateRangeRefSchema,
});

const showNextClassSchema = z.object({
  intent: z.literal("show_next_class"),
});

const showClassesSchema = z.object({
  intent: z.literal("show_classes"),
  range: dateRangeRefSchema,
});

const queryAcademicPeriodSchema = z.object({
  intent: z.literal("query_academic_period"),
  range: dateRangeRefSchema,
  periodKind: z.string(),
});

const showDueItemsSchema = z.object({
  intent: z.literal("show_due_items"),
  range: dateRangeRefSchema,
});

const findAvailabilitySchema = z.object({
  intent: z.literal("find_availability"),
  durationMinutes: z.number().int().positive().max(480),
  startDateKey: dateKeySchema.optional(),
  endDateKey: dateKeySchema.optional(),
  beforeDateKey: dateKeySchema.optional(),
  timeOfDay: z.enum(["morning", "afternoon", "evening"]).optional(),
  range: dateRangeRefSchema.optional(),
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
const createInboxTaskSchema = z.object({
  intent: z.literal("create_inbox_task"),
  title: z.string().min(1).max(500),
});
const showInboxSchema = z.object({ intent: z.literal("show_inbox") });
const startMorningReviewSchema = z.object({
  intent: z.literal("start_morning_review"),
});
const startWeeklyReviewSchema = z.object({
  intent: z.literal("start_weekly_review"),
});
const helpPlanTodaySchema = z.object({ intent: z.literal("help_plan_today") });
const showPendingDecisionsSchema = z.object({
  intent: z.literal("show_pending_decisions"),
});
const deferTaskSchema = z.object({
  intent: z.literal("defer_task"),
  taskId: z.string().uuid().optional(),
  taskTitle: z.string().min(1).optional(),
  untilDateKey: dateKeySchema,
});
const markWaitingSchema = z.object({
  intent: z.literal("mark_waiting"),
  taskId: z.string().uuid().optional(),
  taskTitle: z.string().min(1).optional(),
  reason: z.string().min(1),
  followUpDateKey: dateKeySchema.optional(),
});
const createRecurringTaskSchema = z.object({
  intent: z.literal("create_recurring_task"),
  title: z.string().min(1).max(500),
  byWeekday: z.array(z.number().int().min(0).max(6)).min(1),
  firstOccurrenceDate: dateKeySchema,
  defaultEstimateMinutes: z.number().int().positive().optional(),
  dueTime: timeSchema.optional(),
});
const skipRecurrenceOccurrenceSchema = z.object({
  intent: z.literal("skip_recurrence_occurrence"),
  templateId: z.string().uuid().optional(),
  templateTitle: z.string().min(1).optional(),
  occurrenceDate: dateKeySchema,
});
const pauseRecurringTaskSchema = z.object({
  intent: z.literal("pause_recurring_task"),
  templateId: z.string().uuid().optional(),
  templateTitle: z.string().min(1).optional(),
});
const showRecurringTasksSchema = z.object({
  intent: z.literal("show_recurring_tasks"),
});
const findTimeUnscheduledSchema = z.object({
  intent: z.literal("find_time_unscheduled"),
});
const showAwaitingFeedbackSchema = z.object({
  intent: z.literal("show_awaiting_feedback"),
});
const previewRolloverSchema = z.object({
  intent: z.literal("preview_rollover"),
  targetDateKey: dateKeySchema,
});
const keepTaskOverdueSchema = z.object({
  intent: z.literal("keep_task_overdue"),
  taskId: z.string().uuid().optional(),
  taskTitle: z.string().min(1).optional(),
});
const unknownSchema = z.object({
  intent: z.literal("unknown"),
  raw: z.string(),
});

export const parsedCommandSchema = z.discriminatedUnion("intent", [
  showAgendaSchema,
  showWorkloadSchema,
  scheduleSummarySchema,
  showNextClassSchema,
  showClassesSchema,
  queryAcademicPeriodSchema,
  showDueItemsSchema,
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
  createInboxTaskSchema,
  showInboxSchema,
  startMorningReviewSchema,
  startWeeklyReviewSchema,
  helpPlanTodaySchema,
  showPendingDecisionsSchema,
  deferTaskSchema,
  markWaitingSchema,
  createRecurringTaskSchema,
  skipRecurrenceOccurrenceSchema,
  pauseRecurringTaskSchema,
  showRecurringTasksSchema,
  findTimeUnscheduledSchema,
  showAwaitingFeedbackSchema,
  previewRolloverSchema,
  keepTaskOverdueSchema,
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
