import { ConflictError, DatabaseError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data/bootstrap";
import { listAvailabilityRules } from "@/lib/data/availability";
import { listEventsInRange } from "@/lib/data/events";
import { getPlanningPreferences } from "@/lib/data/preferences";
import { getTaskById, listTasks } from "@/lib/data/tasks";
import {
  getTodayBoundsUtc,
  getWeekBounds,
  getWeekDayKeys,
  getAppLocalDateKey,
  nowInAppTimezone,
} from "@/lib/dates/timezone";
import { mapTaskRow } from "@/lib/tasks/map";
import { buildProposalInputs, toPlanningEvent, toPlanningTask } from "@/lib/planning/mappers";
import {
  applyCalibrationToPlanningTasks,
  loadCalibrationContext,
} from "@/lib/analytics/planning-calibration";
import { getAcademicBlockingEvents } from "@/lib/academic/planning-blocks";
import { generatePlanningProposals } from "@/lib/planning/proposal-generator";
import { computePlanningInputHash } from "@/lib/planning/proposal-hash";
import { getDailyPriorities, getWeeklyPriorities } from "@/lib/data/reviews";
import { sumTrackedSecondsByTaskIds } from "@/lib/data/time-entries";
import { getUnscheduledRemainingWorkMinutes } from "@/lib/planning/remaining-work-math";
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

  const todayKey = getAppLocalDateKey(now);
  const weekStartKey = getAppLocalDateKey(
    getWeekBounds(now, period.weekStartsOn, 0).start,
  );

  const [events, tasks, availabilityRules, preferences, activeRun, academicBlocks, dailyPriorities, weeklyPriorities] =
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
      getDailyPriorities(todayKey).catch(() => []),
      getWeeklyPriorities(weekStartKey).catch(() => []),
    ]);

  const dailyPriorityIds = new Set(dailyPriorities.map((p) => p.task_id));
  const weeklyPriorityIds = new Set(weeklyPriorities.map((p) => p.task_id));

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

  const calibrationContext = await loadCalibrationContext(
    preferences.calibration_reset_at,
  );
  const trackedByTask = await sumTrackedSecondsByTaskIds(
    tasks.map((task) => task.id),
  );
  const calibratedTasks = applyCalibrationToPlanningTasks(
    tasks,
    preferences,
    calibrationContext,
  ).map((task) => ({
    ...task,
    isDailyPriority: dailyPriorityIds.has(task.id),
    isWeeklyPriority: weeklyPriorityIds.has(task.id),
    trackedMinutes: Math.round((trackedByTask.get(task.id) ?? 0) / 60),
  }));

  const base = buildProposalInputs({
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
  });

  return {
    ...base,
    tasks: calibratedTasks,
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
      taskMap.set(task.id, mapTaskRow(task));
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

  const { data: pendingProposals, error: proposalsError } = await supabase
    .from("planning_proposals")
    .select("task_id, proposed_start_at, proposed_end_at, proposed_minutes, status")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .in("task_id", taskIds)
    .gte("proposed_start_at", now);

  if (proposalsError) {
    throw new DatabaseError("Failed to load pending planning proposals");
  }

  const byTask = new Map<string, typeof events>();

  for (const event of events ?? []) {
    if (!event.related_task_id) continue;
    const list = byTask.get(event.related_task_id) ?? [];
    list.push(event);
    byTask.set(event.related_task_id, list);
  }

  const pendingMinutesByTask = new Map<string, number>();
  for (const proposal of pendingProposals ?? []) {
    if (!proposal.task_id) continue;
    pendingMinutesByTask.set(
      proposal.task_id,
      (pendingMinutesByTask.get(proposal.task_id) ?? 0) +
        (proposal.proposed_minutes ?? 0),
    );
  }

  const trackedByTask = await sumTrackedSecondsByTaskIds(taskIds);

  for (const task of tasks) {
    const focusBlocks = byTask.get(task.id) ?? [];
    const trackedMinutes = Math.round((trackedByTask.get(task.id) ?? 0) / 60);
    const planningTask = {
      ...toPlanningTask(task),
      trackedMinutes,
    };

    let futureScheduledFocusMinutes = 0;
    for (const block of focusBlocks) {
      if (task.due_at && block.start_at > task.due_at) continue;
      const minutes = Math.floor(
        (new Date(block.end_at).getTime() - new Date(block.start_at).getTime()) /
          60_000,
      );
      futureScheduledFocusMinutes += minutes;
    }

    const pendingMinutes = pendingMinutesByTask.get(task.id) ?? 0;
    futureScheduledFocusMinutes += pendingMinutes;

    const unscheduledRemainingMinutes = getUnscheduledRemainingWorkMinutes(
      planningTask,
      futureScheduledFocusMinutes - pendingMinutes,
      pendingMinutes,
    );

    const next = focusBlocks[0];

    result.set(task.id, {
      taskId: task.id,
      remainingMinutes: getUnscheduledRemainingWorkMinutes(planningTask, 0, 0),
      futureScheduledFocusMinutes,
      unscheduledRemainingMinutes: unscheduledRemainingMinutes ?? 0,
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

async function getOrCreatePlanningRunForSlot(
  proposedStartAt: string,
): Promise<PlanningRunRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const profile = await getProfile();
  const weekStartsOn = profile.week_starts_on as 0 | 1;
  const reference = new Date(proposedStartAt);
  const { start, end } = getWeekBounds(reference, weekStartsOn, 0);

  const existing = await getActivePlanningRun({
    periodType: "week",
    weekOffset: 0,
  });

  if (existing) {
    return existing.run;
  }

  const { data: run, error } = await supabase
    .from("planning_runs")
    .insert({
      user_id: user.id,
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      status: "generated",
      input_hash: "shelf-manual",
      summary: { source: "task_shelf" } as Json,
    })
    .select("*")
    .single();

  if (error || !run) {
    throw new DatabaseError("Failed to create planning run");
  }

  return run;
}

export async function createShelfPlanningProposal(input: {
  taskId: string;
  proposedStartAt: string;
  proposedEndAt: string;
  clientRequestId?: string;
}): Promise<{ proposalId: string; planningRunId: string; idempotent?: boolean }> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  if (input.clientRequestId) {
    const { data: existingRequest } = await supabase
      .from("planning_client_requests")
      .select("proposal_id")
      .eq("user_id", user.id)
      .eq("client_request_id", input.clientRequestId)
      .maybeSingle();

    if (existingRequest?.proposal_id) {
      const { data: existingProposal } = await supabase
        .from("planning_proposals")
        .select("id, planning_run_id")
        .eq("id", existingRequest.proposal_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingProposal) {
        return {
          proposalId: existingProposal.id,
          planningRunId: existingProposal.planning_run_id,
          idempotent: true,
        };
      }
    }
  }

  const task = await getTaskById(input.taskId);

  const proposedMinutes = Math.max(
    1,
    Math.floor(
      (new Date(input.proposedEndAt).getTime() -
        new Date(input.proposedStartAt).getTime()) /
        60_000,
    ),
  );

  const summaries = await getTaskFocusScheduleSummaries([task]);
  const unscheduledRemaining =
    summaries.get(task.id)?.unscheduledRemainingMinutes ?? 0;
  if (unscheduledRemaining <= 0) {
    throw new ConflictError("This task has no remaining unscheduled work");
  }
  if (proposedMinutes > unscheduledRemaining) {
    throw new ConflictError(
      "Proposed block exceeds remaining unscheduled work",
    );
  }

  const now = new Date();
  const events = await listEventsInRange(
    new Date(
      new Date(input.proposedStartAt).getTime() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    new Date(
      new Date(input.proposedEndAt).getTime() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString(),
  );

  const planningTask = toPlanningTask(task);
  const { getUnscheduledRemainingMinutes } = await import(
    "@/lib/planning/proposal-validation"
  );
  const { getTaskWorkloadMinutes } = await import(
    "@/lib/planning/task-allocation"
  );
  const { buildProposalExplanation } = await import(
    "@/lib/planning/proposal-explanations"
  );
  const { computeProposalHash } = await import("@/lib/planning/proposal-hash");
  const { getFutureConfirmedFocusMinutesForTask } = await import(
    "@/lib/planning/proposal-validation"
  );

  const taskRemaining = getTaskWorkloadMinutes(planningTask) ?? 0;
  const unscheduled = Math.min(
    unscheduledRemaining,
    getUnscheduledRemainingMinutes(
      planningTask,
      events.map(toPlanningEvent),
      now,
    ),
  );
  const scheduledBefore = getFutureConfirmedFocusMinutesForTask(
    planningTask,
    events.map(toPlanningEvent),
    now,
  );

  const explanation = buildProposalExplanation({
    reason: "shelf_manual",
    dueAt: task.due_at,
    availableIntervalMinutes: proposedMinutes,
    taskRemainingMinutes: taskRemaining,
    scheduledTaskMinutesBeforeProposal: scheduledBefore,
    preferenceMatches: [],
    preferenceViolations: [],
  });

  const proposalHash = computeProposalHash({
    taskId: task.id,
    proposedStartAt: input.proposedStartAt,
    proposedEndAt: input.proposedEndAt,
    taskRemainingMinutes: taskRemaining,
    unscheduledRemainingMinutes: unscheduled,
  });

  const run = await getOrCreatePlanningRunForSlot(input.proposedStartAt);

  const { data: proposal, error } = await supabase
    .from("planning_proposals")
    .insert({
      user_id: user.id,
      planning_run_id: run.id,
      task_id: task.id,
      proposed_start_at: input.proposedStartAt,
      proposed_end_at: input.proposedEndAt,
      proposed_minutes: proposedMinutes,
      status: "pending",
      explanation: explanation as Json,
      proposal_hash: proposalHash,
    })
    .select("id")
    .single();

  if (error || !proposal) {
    throw new DatabaseError("Failed to create planning proposal");
  }

  if (input.clientRequestId) {
    const { error: requestError } = await supabase
      .from("planning_client_requests")
      .insert({
        user_id: user.id,
        client_request_id: input.clientRequestId,
        proposal_id: proposal.id,
      });

    if (requestError?.code === "23505") {
      const { data: raced } = await supabase
        .from("planning_client_requests")
        .select("proposal_id")
        .eq("user_id", user.id)
        .eq("client_request_id", input.clientRequestId)
        .maybeSingle();

      if (raced?.proposal_id) {
        const { data: existingProposal } = await supabase
          .from("planning_proposals")
          .select("id, planning_run_id")
          .eq("id", raced.proposal_id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (existingProposal) {
          return {
            proposalId: existingProposal.id,
            planningRunId: existingProposal.planning_run_id,
            idempotent: true,
          };
        }
      }
    } else if (requestError) {
      throw new DatabaseError("Failed to record planning client request");
    }
  }

  return { proposalId: proposal.id, planningRunId: run.id };
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
