"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  acceptProposalsAction,
  generateTodayPlanAction,
  generateWeeklyPlanAction,
  regeneratePlanAction,
  rejectAllPendingProposalsAction,
} from "@/lib/actions/planning";
import { getAppLocalDateKey, formatAppDate } from "@/lib/dates/timezone";
import type { PlanningRunWithProposals } from "@/lib/data/planning";
import { ProposalCard } from "@/components/planning/proposal-card";
import { PlanningSummary } from "@/components/planning/planning-summary";
import { SectionCard, SecondaryButton } from "@/components/forms/ui";

export function PlanningControls({
  periodType,
  weekOffset = 0,
  planningRun,
}: {
  periodType: "day" | "week";
  weekOffset?: number;
  planningRun: PlanningRunWithProposals | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const pendingProposals = useMemo(
    () =>
      (planningRun?.proposals ?? []).filter(
        (proposal) => proposal.status === "pending",
      ),
    [planningRun],
  );

  const proposalsByDay = useMemo(() => {
    const map = new Map<string, typeof pendingProposals>();
    for (const proposal of planningRun?.proposals ?? []) {
      const dayKey = getAppLocalDateKey(proposal.proposed_start_at);
      const list = map.get(dayKey) ?? [];
      list.push(proposal);
      map.set(dayKey, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [planningRun]);

  function handleGenerate() {
    startTransition(async () => {
      setError(null);
      const result =
        periodType === "day"
          ? await generateTodayPlanAction()
          : await generateWeeklyPlanAction({ weekOffset });
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleRegenerate() {
    startTransition(async () => {
      setError(null);
      const result = await regeneratePlanAction({ periodType, weekOffset });
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleRejectAll() {
    if (!planningRun) return;
    startTransition(async () => {
      setError(null);
      const result = await rejectAllPendingProposalsAction(planningRun.run.id);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleAcceptSelected() {
    startTransition(async () => {
      setError(null);
      const result = await acceptProposalsAction({
        proposalIds: [...selectedIds],
      });
      if (result.success) {
        setSelectedIds(new Set());
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const generateLabel =
    periodType === "day" ? "Plan today" : "Generate weekly plan";

  return (
    <SectionCard title="Planning proposals">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={handleGenerate}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {generateLabel}
        </button>
        {planningRun && pendingProposals.length > 0 && (
          <>
            <SecondaryButton disabled={isPending} onClick={handleRegenerate}>
              Regenerate
            </SecondaryButton>
            <SecondaryButton disabled={isPending} onClick={handleRejectAll}>
              Reject all pending
            </SecondaryButton>
            {periodType === "week" && selectedIds.size > 0 && (
              <button
                type="button"
                disabled={isPending}
                onClick={handleAcceptSelected}
                className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                Accept selected ({selectedIds.size})
              </button>
            )}
          </>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {!planningRun && (
        <p className="mt-3 text-sm text-muted">
          Generate a plan to see proposed focus blocks. Nothing is added to your
          calendar until you accept a proposal.
        </p>
      )}

      {planningRun && (
        <div className="mt-4 space-y-4">
          <PlanningSummary run={planningRun.run} />

          {periodType === "day" ? (
            <div className="space-y-3">
              {planningRun.proposals.map((proposal) => (
                <ProposalCard key={proposal.id} proposal={proposal} />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {proposalsByDay.map(([dayKey, proposals]) => (
                <div key={dayKey}>
                  <h3 className="mb-2 text-sm font-medium text-foreground">
                    {formatAppDate(dayKey, "EEEE, MMM d")}
                  </h3>
                  <div className="space-y-3">
                    {proposals.map((proposal) => (
                      <ProposalCard
                        key={proposal.id}
                        proposal={proposal}
                        selectable={proposal.status === "pending"}
                        selected={selectedIds.has(proposal.id)}
                        onSelectChange={(selected) => {
                          setSelectedIds((current) => {
                            const next = new Set(current);
                            if (selected) next.add(proposal.id);
                            else next.delete(proposal.id);
                            return next;
                          });
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {planningRun.proposals.length === 0 && (
            <p className="text-sm text-muted">
              No focus blocks could be proposed for this period with the current
              availability and tasks.
            </p>
          )}
        </div>
      )}
    </SectionCard>
  );
}
