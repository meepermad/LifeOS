import { z } from "zod";
import { TASK_STATUSES } from "@/lib/constants";
import { toUtcFromAppLocal } from "@/lib/dates/timezone";
import type { TaskStatus } from "@/types/domain";

const taskStatusValues = TASK_STATUSES.map((item) => item.value);

const taskFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(500, "Title is too long"),
  description: z.string().max(5000).optional().nullable(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable()
    .or(z.literal("")),
  dueTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable()
    .or(z.literal("")),
  earliestStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable()
    .or(z.literal("")),
  earliestStartTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable()
    .or(z.literal("")),
  estimatedMinutes: z.coerce
    .number()
    .int()
    .min(0, "Estimated minutes cannot be negative")
    .optional()
    .nullable(),
  remainingMinutes: z.coerce
    .number()
    .int()
    .min(0, "Remaining minutes cannot be negative")
    .optional()
    .nullable(),
  priority: z.coerce.number().int().min(1).max(5),
  difficulty: z.coerce.number().int().min(1).max(5),
  status: z.enum(taskStatusValues as [TaskStatus, ...TaskStatus[]]),
  splittable: z.boolean(),
  minimumBlockMinutes: z.coerce.number().int().min(5).max(480),
});

export type TaskFormInput = z.infer<typeof taskFormSchema>;

export type ParsedTaskInput = {
  title: string;
  description: string | null;
  dueAt: string | null;
  earliestStartAt: string | null;
  estimatedMinutes: number | null;
  remainingMinutes: number | null;
  priority: number;
  difficulty: number;
  status: TaskStatus;
  splittable: boolean;
  minimumBlockMinutes: number;
};

function parseOptionalDateTime(
  date: string | null | undefined,
  time: string | null | undefined,
): string | null {
  if (!date) return null;
  const normalizedTime = time && time.length > 0 ? time : "23:59";
  return toUtcFromAppLocal(date, normalizedTime).toISOString();
}

export function parseTaskForm(input: TaskFormInput): ParsedTaskInput {
  const parsed = taskFormSchema.parse(input);

  const dueAt = parseOptionalDateTime(parsed.dueDate, parsed.dueTime);
  const earliestStartAt = parseOptionalDateTime(
    parsed.earliestStartDate,
    parsed.earliestStartTime || "00:00",
  );

  if (
    earliestStartAt &&
    dueAt &&
    new Date(earliestStartAt) > new Date(dueAt)
  ) {
    throw new z.ZodError([
      {
        code: "custom",
        message: "Earliest start cannot be after due date",
        path: ["earliestStartDate"],
      },
    ]);
  }

  const estimatedMinutes = parsed.estimatedMinutes ?? null;
  let remainingMinutes = parsed.remainingMinutes ?? null;

  if (remainingMinutes === null && estimatedMinutes !== null) {
    remainingMinutes = estimatedMinutes;
  }

  if (remainingMinutes !== null && remainingMinutes < 0) {
    throw new z.ZodError([
      {
        code: "custom",
        message: "Remaining minutes cannot be negative",
        path: ["remainingMinutes"],
      },
    ]);
  }

  return {
    title: parsed.title,
    description: parsed.description?.trim() || null,
    dueAt,
    earliestStartAt,
    estimatedMinutes,
    remainingMinutes,
    priority: parsed.priority,
    difficulty: parsed.difficulty,
    status: parsed.status,
    splittable: parsed.splittable,
    minimumBlockMinutes: parsed.minimumBlockMinutes,
  };
}

export function applyTaskCompletion(
  task: {
    estimated_minutes: number | null;
    remaining_minutes: number | null;
  },
  complete: boolean,
): {
  status: TaskStatus;
  remaining_minutes: number | null;
  completed_at: string | null;
} {
  if (complete) {
    return {
      status: "completed",
      remaining_minutes: 0,
      completed_at: new Date().toISOString(),
    };
  }

  const restoredRemaining =
    task.remaining_minutes && task.remaining_minutes > 0
      ? task.remaining_minutes
      : task.estimated_minutes;

  return {
    status: "open",
    remaining_minutes: restoredRemaining,
    completed_at: null,
  };
}
