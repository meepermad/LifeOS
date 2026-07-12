"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  acceptProposalAction,
  rejectProposalAction,
} from "@/lib/actions/planning";
import { formatAppDate, formatAppTimeRange } from "@/lib/dates/timezone";
import type { ProposalWithTask } from "@/lib/data/planning";
import type { ProposalExplanation } from "@/lib/planning/types";
import {
  ExplanationText,
  PreferenceWarnings,
} from "@/components/planning/explanation-text";
import { SecondaryButton } from "@/components/forms/ui";

export function ProposalCard({
  proposal,
  selectable = false,
  selected = false,
  onSelectChange,
}: {
  proposal: ProposalWithTask;
  selectable?: boolean;
  selected?: boolean;
  onSelectChange?: (selected: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const explanation = proposal.explanation as ProposalExplanation;
  const isStale = proposal.status === "stale";
  const isAccepted = proposal.status === "accepted";
  const isRejected = proposal.status === "rejected";
  const isPendingProposal = proposal.status === "pending";

  function handleAccept() {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await acceptProposalAction(proposal.id);
      if (result.success) {
        setMessage("Added to LifeOS Planning.");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleReject() {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await rejectProposalAction(proposal.id);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <article
      className={`rounded-xl border p-4 ${
        isStale
          ? "border-warning/40 bg-warning/5"
          : isAccepted
            ? "border-success/30 bg-success/5"
            : "border-border bg-surface"
      }`}
    >
      <div className="flex items-start gap-3">
        {selectable && isPendingProposal && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onSelectChange?.(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border"
            aria-label={`Select proposal for ${proposal.task_title}`}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-foreground">{proposal.task_title}</h3>
            <span className="text-xs text-muted">
              {proposal.proposed_minutes} min
            </span>
            {isStale && (
              <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning">
                Stale
              </span>
            )}
            {isAccepted && (
              <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">
                Accepted
              </span>
            )}
            {isRejected && (
              <span className="rounded-full bg-muted/15 px-2 py-0.5 text-xs text-muted">
                Rejected
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-foreground">
            {formatAppTimeRange(
              proposal.proposed_start_at,
              proposal.proposed_end_at,
            )}
          </p>
          {proposal.task_due_at && (
            <p className="mt-1 text-xs text-muted">
              Due {formatAppDate(proposal.task_due_at, "MMM d, h:mm a")}
            </p>
          )}
          <div className="mt-2">
            <ExplanationText
              explanation={explanation}
              taskTitle={proposal.task_title}
            />
            <PreferenceWarnings explanation={explanation} />
          </div>
          {message && (
            <p className="mt-2 text-sm text-success">{message}</p>
          )}
          {error && (
            <p className="mt-2 text-sm text-danger">{error}</p>
          )}
          {isStale && (
            <p className="mt-2 text-sm text-warning">
              This proposal is out of date. Regenerate the plan to continue.
            </p>
          )}
        </div>
      </div>
      {isPendingProposal && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={handleAccept}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            Accept
          </button>
          <SecondaryButton disabled={isPending} onClick={handleReject}>
            Reject
          </SecondaryButton>
        </div>
      )}
    </article>
  );
}
