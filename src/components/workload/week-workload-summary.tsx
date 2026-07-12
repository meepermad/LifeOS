import type { WorkloadSummary } from "@/lib/planning/types";
import {
  formatMinutes,
  workloadStatusSentence,
} from "@/lib/planning/summaries";
import { formatAppDate } from "@/lib/dates/timezone";
import { WorkloadStatusBadge } from "@/components/workload/workload-status-badge";
import { SectionCard } from "@/components/forms/ui";

export function WeekWorkloadSummary({
  workload,
}: {
  workload: WorkloadSummary;
}) {
  return (
    <SectionCard
      title="Weekly workload"
      description={workloadStatusSentence(workload.status, "This week")}
    >
      <div className="space-y-4">
        <WorkloadStatusBadge status={workload.status} />

        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-muted">Fixed commitments</dt>
            <dd className="font-medium text-foreground">
              {formatMinutes(workload.fixedMinutes)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Available focus time</dt>
            <dd className="font-medium text-foreground">
              {formatMinutes(workload.availableFocusMinutes)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Estimated task workload</dt>
            <dd className="font-medium text-foreground">
              {formatMinutes(workload.requiredTaskMinutes)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Recommended task work</dt>
            <dd className="font-medium text-foreground">
              {formatMinutes(workload.allocatedTaskMinutes)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Unallocated work</dt>
            <dd className="font-medium text-foreground">
              {formatMinutes(workload.unallocatedTaskMinutes)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Overdue tasks</dt>
            <dd className="font-medium text-foreground">{workload.overdueTaskCount}</dd>
          </div>
          <div>
            <dt className="text-muted">Unestimated tasks</dt>
            <dd className="font-medium text-foreground">
              {workload.unestimatedTaskCount}
            </dd>
          </div>
        </dl>

        {workload.highestPressureDays.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">
              Highest-pressure days
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {workload.highestPressureDays.map((dateKey) => {
                const day = workload.daySummaries.find(
                  (entry) => entry.dateKey === dateKey,
                );
                return (
                  <li
                    key={dateKey}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs"
                  >
                    {formatAppDate(dateKey, "EEE, MMM d")}
                    {day ? ` · ${formatMinutes(day.recommendedTaskMinutes)}` : ""}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {workload.allocation.tasksAtRisk.length > 0 && (
          <p className="text-sm text-warning">
            {workload.allocation.tasksAtRisk.length} task
            {workload.allocation.tasksAtRisk.length === 1 ? " is" : "s are"} at
            risk of missing deadlines.
          </p>
        )}

        {workload.unestimatedTaskCount > 0 && (
          <p className="text-sm text-warning">
            {workload.unestimatedTaskCount} deadline
            {workload.unestimatedTaskCount === 1 ? "" : "s"} still need workload
            estimates.
          </p>
        )}
      </div>
    </SectionCard>
  );
}
