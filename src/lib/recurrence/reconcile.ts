import { getAppLocalDateKey } from "@/lib/dates/timezone";
import { buildOccurrenceDueAt } from "@/lib/recurrence/occurrences";
import type {
  FutureEditPolicy,
  RecurrenceTemplate,
} from "@/lib/recurrence/types";
import type { TaskRow } from "@/types/domain";

export type ReconcileResult = {
  updated: number;
  cancelled: number;
  skippedProtected: number;
};

export function isInstanceProtectedFromReconcile(task: TaskRow): boolean {
  if (task.status === "completed") return true;
  if (task.is_manually_customized) return true;
  if (task.manually_detached_from_recurrence) return true;
  if (task.status === "cancelled" && task.completed_at) return true;
  return false;
}

export function shouldSkipFutureInstance(
  task: TaskRow,
  todayKey: string,
): boolean {
  if (isInstanceProtectedFromReconcile(task)) return true;
  if (!task.recurrence_occurrence_key) return true;
  if (task.recurrence_occurrence_key < todayKey) return true;
  return false;
}

export function buildTemplateFieldPatch(template: RecurrenceTemplate): {
  title: string;
  description: string | null;
  estimated_minutes: number | null;
  remaining_minutes: number | null;
  priority: number;
  difficulty: number;
  course_id: string | null;
} {
  return {
    title: template.title,
    description: template.description,
    estimated_minutes: template.default_estimate_minutes,
    remaining_minutes: template.default_estimate_minutes,
    priority: template.default_priority,
    difficulty: template.default_difficulty,
    course_id: template.course_id,
  };
}

export function planFutureInstanceUpdates(input: {
  template: RecurrenceTemplate;
  tasks: TaskRow[];
  policy: FutureEditPolicy;
  now?: Date;
}): {
  toUpdate: TaskRow[];
  toCancel: TaskRow[];
  protectedSkipped: TaskRow[];
} {
  const todayKey = getAppLocalDateKey(input.now ?? new Date());
  const toUpdate: TaskRow[] = [];
  const toCancel: TaskRow[] = [];
  const protectedSkipped: TaskRow[] = [];

  for (const task of input.tasks) {
    if (shouldSkipFutureInstance(task, todayKey)) {
      if (
        task.recurrence_occurrence_key &&
        task.recurrence_occurrence_key >= todayKey
      ) {
        protectedSkipped.push(task);
      }
      continue;
    }

    if (input.policy === "leave_unchanged") {
      continue;
    }

    if (input.policy === "cancel_and_regenerate") {
      toCancel.push(task);
      continue;
    }

    toUpdate.push(task);
  }

  return { toUpdate, toCancel, protectedSkipped };
}

export function buildReconciledDueAt(
  template: RecurrenceTemplate,
  occurrenceKey: string,
  scheduledDate?: string,
): string {
  return buildOccurrenceDueAt(
    scheduledDate ?? occurrenceKey,
    template.due_time,
    template.recurrence_timezone,
  );
}
