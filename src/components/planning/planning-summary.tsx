import type { ProposalWithTask } from "@/lib/data/planning";
import type { PlanningRunRow } from "@/types/domain";

export function PlanningSummary({
  run,
}: {
  run: PlanningRunRow;
}) {
  const summary = run.summary as {
    totalProposedMinutes?: number;
    fullyScheduledTaskIds?: string[];
    partiallyScheduledTaskIds?: string[];
    unscheduledMinutes?: number;
    unschedulableTasks?: Array<{ taskTitle: string; reason: string }>;
    atRiskTaskIds?: string[];
    warnings?: string[];
  };

  return (
    <div className="grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <span className="text-muted">Total proposed</span>
        <p className="font-medium">{summary.totalProposedMinutes ?? 0} min</p>
      </div>
      <div>
        <span className="text-muted">Fully scheduled tasks</span>
        <p className="font-medium">
          {summary.fullyScheduledTaskIds?.length ?? 0}
        </p>
      </div>
      <div>
        <span className="text-muted">Partially scheduled</span>
        <p className="font-medium">
          {summary.partiallyScheduledTaskIds?.length ?? 0}
        </p>
      </div>
      <div>
        <span className="text-muted">Unscheduled minutes</span>
        <p className="font-medium">{summary.unscheduledMinutes ?? 0}</p>
      </div>
      {(summary.unschedulableTasks?.length ?? 0) > 0 && (
        <div className="sm:col-span-2">
          <span className="text-muted">Unschedulable tasks</span>
          <ul className="mt-1 space-y-1">
            {summary.unschedulableTasks?.map((task) => (
              <li key={task.taskTitle} className="text-warning">
                {task.taskTitle}: {task.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      {(summary.warnings?.length ?? 0) > 0 && (
        <div className="sm:col-span-2">
          <ul className="space-y-1 text-xs text-warning">
            {summary.warnings?.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function PlanningSummaryFromProposals({
  proposals,
  summary,
}: {
  proposals: ProposalWithTask[];
  summary?: PlanningRunRow["summary"];
}) {
  const parsed = (summary ?? {}) as {
    totalProposedMinutes?: number;
    fullyScheduledTaskIds?: string[];
    partiallyScheduledTaskIds?: string[];
    unscheduledMinutes?: number;
    unschedulableTasks?: Array<{ taskTitle: string; reason: string }>;
  };

  const total =
    parsed.totalProposedMinutes ??
    proposals.reduce((sum, p) => sum + p.proposed_minutes, 0);

  return (
    <div className="grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <span className="text-muted">Total proposed</span>
        <p className="font-medium">{total} min</p>
      </div>
      <div>
        <span className="text-muted">Proposals</span>
        <p className="font-medium">{proposals.length}</p>
      </div>
      {(parsed.unschedulableTasks?.length ?? 0) > 0 && (
        <div className="sm:col-span-2">
          <span className="text-muted">Unschedulable tasks</span>
          <ul className="mt-1 space-y-1">
            {parsed.unschedulableTasks?.map((task) => (
              <li key={task.taskTitle} className="text-warning">
                {task.taskTitle}: {task.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
