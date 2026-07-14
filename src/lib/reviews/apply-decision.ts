import {
  addAppDays,
  getAppLocalDateKey,
  toUtcFromAppLocal,
} from "@/lib/dates/timezone";
import { updateTaskDueAt } from "@/lib/data/due-date-revisions";
import {
  cancelTask,
  deferTask,
  markWaiting,
  returnTaskToInbox,
} from "@/lib/data/inbox";
import { createShelfPlanningProposal } from "@/lib/data/planning";
import { recordReviewDecision } from "@/lib/data/reviews";
import { getTaskById } from "@/lib/data/tasks";
import { splitTask } from "@/lib/data/task-split";
import type {
  ReviewDecisionRow,
  ReviewDecisionType,
} from "@/lib/reviews/types";
import { ConflictError } from "@/lib/errors/app-error";

export type ApplyReviewDecisionInput = {
  sessionId: string;
  taskId: string;
  decisionType: ReviewDecisionType;
  decisionPayload?: {
    newDueAt?: string | null;
    deferredUntilAt?: string;
    waitingReason?: string;
    waitingFollowUpAt?: string | null;
    proposedStartAt?: string;
    proposedEndAt?: string;
    children?: Array<{ title: string; remainingMinutes: number }>;
    [key: string]: unknown;
  } | null;
};

function defaultTomorrowDueAt(fromDateKey?: string): string {
  const base = fromDateKey ?? getAppLocalDateKey(new Date());
  const tomorrow = addAppDays(base, 1);
  return toUtcFromAppLocal(tomorrow, "23:59").toISOString();
}

function defaultTomorrowFocusWindow(minutes: number): {
  proposedStartAt: string;
  proposedEndAt: string;
} {
  const tomorrow = addAppDays(getAppLocalDateKey(new Date()), 1);
  const duration = Math.max(15, Math.min(minutes, 120));
  const start = toUtcFromAppLocal(tomorrow, "09:00");
  const end = new Date(start.getTime() + duration * 60_000);
  return {
    proposedStartAt: start.toISOString(),
    proposedEndAt: end.toISOString(),
  };
}

export async function applyReviewDecision(
  input: ApplyReviewDecisionInput,
): Promise<ReviewDecisionRow> {
  const task = await getTaskById(input.taskId);
  const payload = input.decisionPayload ?? {};
  const effects: Record<string, unknown> = {
    decision_type: input.decisionType,
  };

  switch (input.decisionType) {
    case "keep_due_date":
    case "acknowledge":
    case "confirm_priority":
    case "reduce_scope": {
      effects.due_at_unchanged = true;
      break;
    }

    case "move_due_date":
    case "change_deadline": {
      const newDueAt =
        (payload.newDueAt as string | null | undefined) ??
        defaultTomorrowDueAt();
      const updated = await updateTaskDueAt(task.id, newDueAt, {
        source: "daily_review",
        reason: input.decisionType,
        reviewSessionId: input.sessionId,
      });
      effects.previous_due_at = task.due_at;
      effects.new_due_at = updated.due_at;
      break;
    }

    case "schedule_tomorrow": {
      const remaining =
        task.remaining_minutes ??
        task.estimated_minutes ??
        task.minimum_block_minutes ??
        45;
      const window =
        payload.proposedStartAt && payload.proposedEndAt
          ? {
              proposedStartAt: payload.proposedStartAt as string,
              proposedEndAt: payload.proposedEndAt as string,
            }
          : defaultTomorrowFocusWindow(remaining);

      const proposal = await createShelfPlanningProposal({
        taskId: task.id,
        proposedStartAt: window.proposedStartAt,
        proposedEndAt: window.proposedEndAt,
      });
      effects.due_at_unchanged = true;
      effects.due_at = task.due_at;
      effects.proposal_id = proposal.proposalId;
      effects.planning_run_id = proposal.planningRunId;
      effects.proposed_start_at = window.proposedStartAt;
      effects.proposed_end_at = window.proposedEndAt;
      break;
    }

    case "defer": {
      const untilAt =
        (payload.deferredUntilAt as string | undefined) ??
        defaultTomorrowDueAt();
      await deferTask(task.id, untilAt);
      effects.due_at_unchanged = true;
      effects.deferred_until_at = untilAt;
      break;
    }

    case "return_to_inbox": {
      await returnTaskToInbox(task.id);
      effects.returned_to_inbox = true;
      effects.due_at_unchanged = true;
      break;
    }

    case "mark_waiting": {
      const reason =
        (payload.waitingReason as string | undefined)?.trim() ||
        "Waiting on someone else";
      const followUpAt =
        (payload.waitingFollowUpAt as string | null | undefined) ??
        defaultTomorrowDueAt();
      await markWaiting(task.id, {
        reason,
        followUpAt,
      });
      effects.waiting_reason = reason;
      effects.waiting_follow_up_at = followUpAt;
      effects.due_at_unchanged = true;
      break;
    }

    case "cancel": {
      await cancelTask(task.id);
      effects.status = "cancelled";
      break;
    }

    case "split_task": {
      const children = payload.children as
        | Array<{ title: string; remainingMinutes: number }>
        | undefined;
      if (children && children.length >= 2) {
        const result = await splitTask({ taskId: task.id, children });
        effects.split = result;
      } else {
        effects.split_skipped = true;
        effects.reason = "No children provided";
      }
      break;
    }

    default: {
      throw new ConflictError(
        `Unsupported review decision: ${input.decisionType}`,
      );
    }
  }

  return recordReviewDecision({
    sessionId: input.sessionId,
    taskId: input.taskId,
    decisionType: input.decisionType,
    decisionPayload: {
      ...payload,
      effects,
    },
  });
}
