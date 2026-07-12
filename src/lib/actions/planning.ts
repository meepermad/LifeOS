"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import {
  acceptProposal,
  generateAndStorePlanningRun,
  getActivePlanningRun,
  markProposalStale,
  rejectAllPendingProposals,
  rejectProposal,
  loadPlanningInputs,
} from "@/lib/data/planning";
import { listEventsInRange } from "@/lib/data/events";
import { listTasks } from "@/lib/data/tasks";
import { getLifeOSPlanningCalendar } from "@/lib/data/calendars";
import { getPlanningPreferences } from "@/lib/data/preferences";
import { toPlanningEvent, toPlanningTask } from "@/lib/planning/mappers";
import { validateProposalForAcceptance } from "@/lib/planning/proposal-validation";
import {
  acceptProposalsSchema,
  proposalIdSchema,
  regeneratePlanSchema,
  weeklyPlanSchema,
} from "@/lib/validation/planning";
import { AppError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import type { ProposalWithTask, PlanningRunWithProposals } from "@/lib/data/planning";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

function toActionError<T = void>(error: unknown): ActionResult<T> {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "form";
      fieldErrors[key] = issue.message;
    }
    return { success: false, error: "Validation failed", fieldErrors };
  }

  if (error instanceof AppError) {
    return { success: false, error: error.message };
  }

  if (error instanceof Error) {
    return { success: false, error: error.message };
  }

  return { success: false, error: "An unexpected error occurred" };
}

function revalidatePlanningPaths() {
  revalidatePath("/today");
  revalidatePath("/week");
  revalidatePath("/tasks");
}

export async function generateTodayPlanAction(): Promise<
  ActionResult<PlanningRunWithProposals>
> {
  try {
    const result = await generateAndStorePlanningRun({ periodType: "day" });
    revalidatePlanningPaths();
    return { success: true, data: result };
  } catch (error) {
    return toActionError(error);
  }
}

export async function generateWeeklyPlanAction(
  input: unknown = {},
): Promise<ActionResult<PlanningRunWithProposals>> {
  try {
    const parsed = weeklyPlanSchema.parse(input);
    const result = await generateAndStorePlanningRun({
      periodType: "week",
      weekOffset: parsed.weekOffset,
    });
    revalidatePlanningPaths();
    return { success: true, data: result };
  } catch (error) {
    return toActionError(error);
  }
}

async function validateBeforeAccept(
  proposal: ProposalWithTask,
): Promise<{ valid: true } | { valid: false; reason: string }> {
  const user = await requireAllowedUser();
  const calendar = await getLifeOSPlanningCalendar();
  const [events, tasks, preferences] = await Promise.all([
    listEventsInRange(
      proposal.proposed_start_at,
      proposal.proposed_end_at,
    ),
    listTasks({ status: "active", sort: "due_date" }),
    getPlanningPreferences(),
  ]);

  const supabase = await createClient();
  const { data: run } = await supabase
    .from("planning_runs")
    .select("*")
    .eq("id", proposal.planning_run_id)
    .eq("user_id", user.id)
    .single();

  if (!run) {
    return { valid: false, reason: "Planning run not found." };
  }

  const task = tasks.find((t) => t.id === proposal.task_id) ?? null;

  const validation = validateProposalForAcceptance({
    proposal: {
      id: proposal.id,
      taskId: proposal.task_id,
      proposedStartAt: proposal.proposed_start_at,
      proposedEndAt: proposal.proposed_end_at,
      proposedMinutes: proposal.proposed_minutes,
      proposalHash: proposal.proposal_hash,
      status: proposal.status,
      planningRunId: proposal.planning_run_id,
    },
    run: { id: run.id, status: run.status },
    task: task ? toPlanningTask(task) : null,
    events: events.map(toPlanningEvent),
    preferences: {
      minimumBreakMinutes: preferences.minimum_break_minutes,
      travelBufferMinutes: preferences.travel_buffer_minutes,
      planningBufferPercent: preferences.planning_buffer_percent,
      preferredFocusBlockMinutes: preferences.preferred_focus_block_minutes,
      maximumFocusBlockMinutes: preferences.maximum_focus_block_minutes,
      avoidDifficultWorkAfter: preferences.avoid_difficult_work_after,
    },
    calendarWritable: calendar?.is_writable ?? false,
    userId: user.id,
    ownerUserId: proposal.user_id,
  });

  return validation;
}

export async function acceptProposalAction(
  proposalId: string,
): Promise<ActionResult<{ eventId: string; idempotent: boolean }>> {
  try {
    const id = proposalIdSchema.parse(proposalId);
    const user = await requireAllowedUser();
    const supabase = await createClient();

    const { data: proposal, error } = await supabase
      .from("planning_proposals")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !proposal) {
      return { success: false, error: "Proposal not found" };
    }

    const withTask: ProposalWithTask = {
      ...proposal,
      task_title: "",
      task_due_at: null,
    };

    const validation = await validateBeforeAccept(withTask);
    if (!validation.valid) {
      await markProposalStale(id);
      return {
        success: false,
        error: `${validation.reason} Regenerate the plan to continue.`,
      };
    }

    const result = await acceptProposal(id);
    revalidatePlanningPaths();
    return { success: true, data: result };
  } catch (error) {
    return toActionError(error);
  }
}

export async function acceptProposalsAction(
  input: unknown,
): Promise<
  ActionResult<{
    accepted: Array<{ proposalId: string; eventId: string }>;
    failed: Array<{ proposalId: string; error: string }>;
  }>
> {
  try {
    const parsed = acceptProposalsSchema.parse(input);
    const accepted: Array<{ proposalId: string; eventId: string }> = [];
    const failed: Array<{ proposalId: string; error: string }> = [];

    for (const proposalId of parsed.proposalIds) {
      const result = await acceptProposalAction(proposalId);
      if (result.success && result.data) {
        accepted.push({ proposalId, eventId: result.data.eventId });
      } else {
        failed.push({
          proposalId,
          error: result.success ? "Unknown error" : result.error,
        });
      }
    }

    return { success: true, data: { accepted, failed } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function acceptAllValidProposalsAction(
  runId: string,
): Promise<
  ActionResult<{
    accepted: number;
    failed: number;
  }>
> {
  try {
    const user = await requireAllowedUser();
    const supabase = await createClient();

    const { data: proposals, error } = await supabase
      .from("planning_proposals")
      .select("*")
      .eq("planning_run_id", runId)
      .eq("user_id", user.id)
      .eq("status", "pending");

    if (error) {
      return { success: false, error: "Failed to load proposals" };
    }

    let accepted = 0;
    let failed = 0;

    for (const proposal of proposals ?? []) {
      const result = await acceptProposalAction(proposal.id);
      if (result.success) accepted += 1;
      else failed += 1;
    }

    return { success: true, data: { accepted, failed } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function rejectProposalAction(
  proposalId: string,
): Promise<ActionResult> {
  try {
    const id = proposalIdSchema.parse(proposalId);
    await rejectProposal(id);
    revalidatePlanningPaths();
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function rejectAllPendingProposalsAction(
  runId: string,
): Promise<ActionResult> {
  try {
    await rejectAllPendingProposals(runId);
    revalidatePlanningPaths();
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function regeneratePlanAction(
  input: unknown,
): Promise<ActionResult<PlanningRunWithProposals>> {
  try {
    const parsed = regeneratePlanSchema.parse(input);
    const result = await generateAndStorePlanningRun({
      periodType: parsed.periodType,
      weekOffset: parsed.weekOffset,
    });
    revalidatePlanningPaths();
    return { success: true, data: result };
  } catch (error) {
    return toActionError(error);
  }
}

export async function getActivePlanningRunAction(
  periodType: "day" | "week",
  weekOffset?: number,
): Promise<ActionResult<PlanningRunWithProposals | null>> {
  try {
    const result = await getActivePlanningRun({ periodType, weekOffset });
    return { success: true, data: result };
  } catch (error) {
    return toActionError(error);
  }
}

export async function loadPlanningPreviewAction(
  periodType: "day" | "week",
  weekOffset?: number,
) {
  try {
    const inputs = await loadPlanningInputs({ periodType, weekOffset });
    return { success: true as const, data: inputs };
  } catch (error) {
    return toActionError(error);
  }
}
