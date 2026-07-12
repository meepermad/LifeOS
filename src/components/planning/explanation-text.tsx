import type { ProposalExplanation } from "@/lib/planning/types";
import { formatProposalExplanation, formatPreferenceWarnings } from "@/lib/planning/proposal-explanations";

export function ExplanationText({
  explanation,
  taskTitle,
}: {
  explanation: ProposalExplanation;
  taskTitle?: string;
}) {
  return (
    <p className="text-sm text-muted">
      {formatProposalExplanation(explanation, taskTitle)}
    </p>
  );
}

export function PreferenceWarnings({
  explanation,
}: {
  explanation: ProposalExplanation;
}) {
  const warnings = formatPreferenceWarnings(explanation);
  if (warnings.length === 0) return null;

  return (
    <ul className="mt-2 space-y-1">
      {warnings.map((warning) => (
        <li key={warning} className="text-xs text-warning">
          {warning}
        </li>
      ))}
    </ul>
  );
}
