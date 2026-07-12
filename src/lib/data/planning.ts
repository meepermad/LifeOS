import { DatabaseError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data/bootstrap";
import { listAvailabilityRules } from "@/lib/data/availability";
import { listEventsInRange } from "@/lib/data/events";
import { getPlanningPreferences } from "@/lib/data/preferences";
import { listTasks } from "@/lib/data/tasks";
import {
  getTodayBoundsUtc,
  getWeekBounds,
  getWeekDayKeys,
  getAppLocalDateKey,
  nowInAppTimezone,
} from "@/lib/dates/timezone";
import { buildProposalInputs } from "@/lib/planning/mappers";
import { toPlanningEvent } from "@/lib/planning/mappers";
import { getAcademicBlockingEvents } from "@/lib/academic/planning-blocks";
import { generatePlanningProposals } from "@/lib/planning/proposal-generator";
import { computePlanningInputHash } from "@/lib/planning/proposal-hash";
import type {
  FocusBlockProposal,
  PlanningGenerationResult,
  PlanningProposalInput,
} from "@/lib/planning/types";
import type {
  PlanningProposalRow,
  PlanningProposalStatus,
  PlanningRunRow,
  PlanningRunStatus,
  TaskRow,
} from "@/types/domain";
import type { Json } from "@/types/database.types";

export type PlanningPeriodRequest = {
  periodType: "day" | "week";
  weekOffset?: number;
};

export type ProposalWithTask = PlanningProposalRow & {
  task_title: string;
  task_due_at: string | null;
};

export type PlanningRunWithProposals = {
  run: PlanningRunRow;
  proposals: ProposalWithTask[];
};

export type TaskFocusScheduleSummary = {
  taskId: string;
  remainingMinutes: number | null;
  futureScheduledFocusMinutes: number;
  unscheduledRemainingMinutes: number;
  nextFocusBlock: {
    id: string;
    startAt: string;
    endAt: string;
  } | null;
};

async function resolvePeriod(request: PlanningPeriodRequest): Promise<{
  periodStart: Date;
  periodEnd: Date;
  dayKeys: string[];
  weekStartsOn: 0 | 1;
}> {
  const profile = await getProfile();
  const weekStartsOn = profile.week_starts_on as 0 | 1;
  const reference = nowInAppTimezone();

  if (request.periodType === "day") {
    const bounds = getTodayBoundsUtc(reference);
    return {
      periodStart: bounds.start,
      periodEnd: bounds.end,
      dayKeys: [getAppLocalDateKey(reference)],
      weekStartsOn,
    };
  }

  const { start, end } = getWeekBounds(
    reference,
    weekStartsOn,
    request.weekOffset ?? 0,
  );

  return {
    periodStart: start,
    periodEnd: end,
    dayKeys: getWeekDayKeys(start, weekStartsOn),
    weekStartsOn,
  };
}

export async function loadPlanningInputs(
  request: PlanningPeriodRequest,
): Promise<PlanningProposalInput> {
  const period = await resolvePeriod(request);
  const now = new Date();

  const [events, tasks, availabilityRules, preferences, activeRun, academicBlocks] =
    await Promise.all([
      listEventsInRange(
        period.periodStart.toISOString(),
        period.periodEnd.toISOString(),
      ),
      listTasks({ status: "active", sort: "due_date" }),
      listAvailabilityRules(),
      getPlanningPreferences(),
      getActivePlanningRun(request),
      getAcademicBlockingEvents(period.dayKeys),
    ]);

  const acceptedProposalIntervals =
    activeRun?.proposals
      .filter((p) => p.status === "accepted")
      .map((p) => ({
        taskId: p.task_id,
        startAt: p.proposed_start_at,
        endAt: p.proposed_end_at,
      })) ?? [];

  const pendingProposalIntervals =
    activeRun?.proposals
      .filter((p) => p.status === "pending")
      .map((p) => ({
        taskId: p.task_id,
        startAt: p.proposed_start_at,
        endAt: p.proposed_end_at,
      })) ?? [];

  return {
    ...buildProposalInputs({
      events,
      tasks,
      availabilityRules,
      preferences,
      weekStartsOn: period.weekStartsOn,
      now,
      periodType: request.periodType,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      dayKeys: period.dayKeys,
      pendingProposalIntervals,
      acceptedProposalIntervals,
    }),
    events: [
      ...events.map(toPlanningEvent),
      ...academicBlocks,
    ],
  };
}

export async function generateAndStorePlanningRun(
  request: PlanningPeriodRequest,
): Promise<PlanningRunWithProposals> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const period = await resolvePeriod(request);

  await markPriorRunsStale(
    period.periodStart.toISOString(),
    period.periodEnd.toISOString(),
  );

  const inputs = await loadPlanningInputs(request);
  const result = generatePlanningProposals({
    ...inputs,
    pendingProposalIntervals: [],
  });
  const inputHash = computePlanningInputHash({
    ...inputs,
    pendingProposalIntervals: [],
  });

  const summary = buildRunSummary(result);

  const { data: run, error: runError } = await supabase
    .from("planning_runs")
    .insert({
      user_id: user.id,
      period_start: period.periodStart.toISOString(),
      period_end: period.periodEnd.toISOString(),
      status: "generated",
      input_hash: inputHash,
      summary: summary as Json,
    })
    .select("*")
    .single();

  if (runError || !run) {
    throw new DatabaseError("Failed to create planning run");
  }

  if (result.proposals.length > 0) {
    const proposalRows = result.proposals.map((proposal) => ({
      user_id: user.id,
      planning_run_id: run.id,
      task_id: proposal.taskId,
      proposed_start_at: proposal.proposedStartAt,
      proposed_end_at: proposal.proposedEndAt,
      proposed_minutes: proposal.proposedMinutes,
      status: "pending",
      explanation: proposal.explanation as Json,
      proposal_hash: proposal.proposalHash,
    }));

    const { error: proposalsError } = await supabase
      .from("planning_proposals")
      .insert(proposalRows);

    if (proposalsError) {
      throw new DatabaseError("Failed to create planning proposals");
    }
  }

  const proposals = await listProposalsForRun(run.id);
  return { run, proposals };
}

function buildRunSummary(result: PlanningGenerationResult): Record<string, unknown> {
  return {
    totalProposedMinutes: result.totalProposedMinutes,
    fullyScheduledTaskIds: result.fullyScheduledTaskIds,
    partiallyScheduledTaskIds: result.partiallyScheduledTaskIds,
    unscheduledMinutes: result.unscheduledMinutes,
    unschedulableTasks: result.unschedulableTasks,
    warnings: result.warnings,
    atRiskTaskIds: result.atRiskTaskIds,
  };
}

export async function markPriorRunsStale(
  periodStart: string,
  periodEnd: string,
): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data: runs, error } = await supabase
    .from("planning_runs")
    .select("id")
    .eq("user_id", user.id)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .in("status", ["generated", "partially_accepted"]);

  if (error) {
    throw new DatabaseError("Failed to load prior planning runs");
  }

  const runIds = (runs ?? []).map((run) => run.id);
  if (runIds.length === 0) return;

  await supabase
    .from("planning_runs")
    .update({ status: "stale" })
    .in("id", runIds);

  await supabase
    .from("planning_proposals")
    .update({ status: "stale" })
    .in("planning_run_id", runIds)
    .eq("status", "pending");
}

export async function getActivePlanningRun(
  request: PlanningPeriodRequest,
): Promise<PlanningRunWithProposals | null> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const period = await resolvePeriod(request);

  const { data: run, error } = await supabase
    .from("planning_runs")
    .select("*")
    .eq("user_id", user.id)
    .eq("period_start", period.periodStart.toISOString())
    .eq("period_end", period.periodEnd.toISOString())
    .in("status", ["generated", "partially_accepted", "accepted"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new DatabaseError("Failed to load planning run");
  }

  if (!run) return null;

  const proposals = await listProposalsForRun(run.id);
  return { run, proposals };
}

export async function listProposalsForRun(
  runId: string,
): Promise<ProposalWithTask[]> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data: proposals, error } = await supabase
    .from("planning_proposals")
    .select("*")
    .eq("user_id", user.id)
    .eq("planning_run_id", runId)
    .order("proposed_start_at", { ascending: true });

  if (error) {
    throw new DatabaseError("Failed to load planning proposals");
  }

  const taskIds = [...new Set((proposals ?? []).map((p) => p.task_id))];
  const taskMap = new Map<string, TaskRow>();

  if (taskIds.length > 0) {
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .in("id", taskIds);

    if (tasksError) {
      throw new DatabaseError("Failed to load proposal tasks");
    }

    for (const task of tasks ?? []) {
      taskMap.set(task.id, task);
    }
  }

  return (proposals ?? []).map((proposal) => {
    const task = taskMap.get(proposal.task_id);
    return {
      ...proposal,
      task_title: task?.title ?? "Unknown task",
      task_due_at: task?.due_at ?? null,
    };
  });
}

export async function acceptProposal(
  proposalId: string,
): Promise<{ eventId: string; idempotent: boolean }> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("accept_planning_proposal", {
    p_proposal_id: proposalId,
  });

  if (error) {
    throw new DatabaseError(error.message);
  }

  const result = data as { success: boolean; event_id: string; idempotent: boolean };
  if (!result?.success || !result.event_id) {
    throw new DatabaseError("Failed to accept proposal");
  }

  void user;
  return { eventId: result.event_id, idempotent: result.idempotent ?? false };
}

export async function rejectProposal(proposalId: string): Promise<void> {
  await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("reject_planning_proposal", {
    p_proposal_id: proposalId,
  });

  if (error) {
    throw new DatabaseError(error.message);
  }

  const result = data as { success?: boolean };
  if (!result?.success) {
    throw new DatabaseError("Failed to reject proposal");
  }
}

export async function rejectAllPendingProposals(runId: string): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("planning_proposals")
    .update({
      status: "rejected" satisfies PlanningProposalStatus,
      rejected_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("planning_run_id", runId)
    .eq("status", "pending");

  if (error) {
    throw new DatabaseError("Failed to reject proposals");
  }

  await supabase
    .from("planning_runs")
    .update({ status: "rejected" satisfies PlanningRunStatus })
    .eq("id", runId)
    .eq("user_id", user.id);
}

export async function markProposalStale(proposalId: string): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("planning_proposals")
    .update({ status: "stale" satisfies PlanningProposalStatus })
    .eq("id", proposalId)
    .eq("user_id", user.id);

  if (error) {
    throw new DatabaseError("Failed to mark proposal stale");
  }
}

export async function getTaskFocusScheduleSummaries(
  tasks: TaskRow[],
): Promise<Map<string, TaskFocusScheduleSummary>> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const result = new Map<string, TaskFocusScheduleSummary>();

  if (tasks.length === 0) return result;

  const taskIds = tasks.map((task) => task.id);

  const { data: events, error } = await supabase
    .from("events")
    .select("id, related_task_id, start_at, end_at, event_type, status")
    .eq("user_id", user.id)
    .eq("event_type", "focus_block")
    .eq("status", "confirmed")
    .in("related_task_id", taskIds)
    .gte("start_at", now)
    .order("start_at", { ascending: true });

  if (error) {
    throw new DatabaseError("Failed to load focus blocks");
  }

  const byTask = new Map<string, typeof events>();

  for (const event of events ?? []) {
    if (!event.related_task_id) continue;
    const list = byTask.get(event.related_task_id) ?? [];
    list.push(event);
    byTask.set(event.related_task_id, list);
  }

  for (const task of tasks) {
    const focusBlocks = byTask.get(task.id) ?? [];
    const remaining = task.remaining_minutes ?? task.estimated_minutes;

    let futureScheduledFocusMinutes = 0;
    for (const block of focusBlocks) {
      if (task.due_at && block.start_at > task.due_at) continue;
      const minutes = Math.floor(
        (new Date(block.end_at).getTime() - new Date(block.start_at).getTime()) /
          60_000,
      );
      futureScheduledFocusMinutes += minutes;
    }

    const unscheduledRemainingMinutes =
      remaining != null
        ? Math.max(0, remaining - futureScheduledFocusMinutes)
        : 0;

    const next = focusBlocks[0];

    result.set(task.id, {
      taskId: task.id,
      remainingMinutes: remaining,
      futureScheduledFocusMinutes,
      unscheduledRemainingMinutes,
      nextFocusBlock: next
        ? {
            id: next.id,
            startAt: next.start_at,
            endAt: next.end_at,
          }
        : null,
    });
  }

  return result;
}

export function proposalRowToFocusBlock(
  proposal: PlanningProposalRow,
  taskTitle: string,
): FocusBlockProposal {
  return {
    taskId: proposal.task_id,
    taskTitle,
    proposedStartAt: proposal.proposed_start_at,
    proposedEndAt: proposal.proposed_end_at,
    proposedMinutes: proposal.proposed_minutes,
    explanation: proposal.explanation as FocusBlockProposal["explanation"],
    proposalHash: proposal.proposal_hash,
  };
}
