"use client";

import { useState } from "react";
import type { WorkloadSummary } from "@/lib/planning/types";
import {
  formatMinutes,
  workloadStatusSentence,
} from "@/lib/planning/summaries";
import { WorkloadStatusBadge } from "@/components/workload/workload-status-badge";
import { SectionCard } from "@/components/forms/ui";

export function WorkloadSummaryCard({
  workload,
  title = "Workload",
}: {
  workload: WorkloadSummary;
  title?: string;
}) {
  const [showExplanation, setShowExplanation] = useState(false);
  const todaySummary = workload.daySummaries[0];

  return (
    <SectionCard
      title={title}
      description={workloadStatusSentence(workload.status, "Today")}
    >
      <div className="space-y-3">
        <WorkloadStatusBadge status={workload.status} />

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Available focus time</dt>
            <dd className="font-medium text-foreground">
              {formatMinutes(workload.availableFocusMinutes)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Recommended task work</dt>
            <dd className="font-medium text-foreground">
              {formatMinutes(todaySummary?.recommendedTaskMinutes ?? 0)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Reserved buffer</dt>
            <dd className="font-medium text-foreground">
              {formatMinutes(workload.reservedBufferMinutes)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Fixed commitments</dt>
            <dd className="font-medium text-foreground">
              {formatMinutes(workload.fixedMinutes)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Estimated task work</dt>
            <dd className="font-medium text-foreground">
              {formatMinutes(workload.requiredTaskMinutes)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Unallocated work</dt>
            <dd className="font-medium text-foreground">
              {formatMinutes(workload.unallocatedTaskMinutes)}
            </dd>
          </div>
        </dl>

        {(workload.overdueTaskCount > 0 || workload.unestimatedTaskCount > 0) && (
          <div className="space-y-1 text-sm text-warning">
            {workload.overdueTaskCount > 0 && (
              <p>
                {workload.overdueTaskCount} overdue task
                {workload.overdueTaskCount === 1 ? "" : "s"}.
              </p>
            )}
            {workload.unestimatedTaskCount > 0 && (
              <p>
                {workload.unestimatedTaskCount} task
                {workload.unestimatedTaskCount === 1 ? " lacks" : "s lack"} estimates,
                so the true workload may be higher.
              </p>
            )}
          </div>
        )}

        {workload.needsAvailabilityConfiguration && (
          <p className="text-sm text-warning">
            Availability is not configured for today. Add rules in Settings to
            calculate focus time.
          </p>
        )}

        {workload.tentativeEventIds.length > 0 && (
          <p className="text-sm text-muted">
            {workload.tentativeEventIds.length} tentative event
            {workload.tentativeEventIds.length === 1 ? "" : "s"} may affect your
            day but are not reducing capacity yet.
          </p>
        )}

        <button
          type="button"
          onClick={() => setShowExplanation((value) => !value)}
          className="text-sm text-accent hover:underline"
        >
          {showExplanation ? "Hide" : "How this was calculated"}
        </button>

        {showExplanation && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            {workload.explanation.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}
