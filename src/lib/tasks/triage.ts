import type { TaskRow, WorkflowState } from "@/types/domain";

export type TaskTriageFields = Pick<
  TaskRow,
  | "inbox_at"
  | "due_at"
  | "workflow_state"
  | "deferred_until_at"
  | "sync_managed"
>;

const NON_ACTIONABLE_WORKFLOW: WorkflowState[] = [
  "waiting",
  "someday",
  "backlog",
];

export function isInboxTask(task: Pick<TaskRow, "inbox_at">): boolean {
  return task.inbox_at != null;
}

export function canExitInbox(
  task: TaskTriageFields,
  options?: { hasFutureFocusBlock?: boolean },
): boolean {
  if (task.due_at) {
    return true;
  }
  if (options?.hasFutureFocusBlock) {
    return true;
  }
  if (
    task.workflow_state &&
    NON_ACTIONABLE_WORKFLOW.includes(task.workflow_state as WorkflowState)
  ) {
    return true;
  }
  if (task.deferred_until_at) {
    return true;
  }
  return false;
}

export function isDeferredHidden(
  task: Pick<TaskRow, "deferred_until_at">,
  now: Date = new Date(),
): boolean {
  if (!task.deferred_until_at) {
    return false;
  }
  return new Date(task.deferred_until_at) > now;
}

export function isActionableWorkload(
  task: TaskTriageFields,
  now: Date = new Date(),
): boolean {
  if (isInboxTask(task)) {
    return false;
  }
  if (task.workflow_state && task.workflow_state !== "actionable") {
    return false;
  }
  if (isDeferredHidden(task, now)) {
    return false;
  }
  return true;
}

export function shouldAssignInboxAt(task: Pick<TaskRow, "sync_managed">): boolean {
  return !task.sync_managed;
}
