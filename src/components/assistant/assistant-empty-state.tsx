export function AssistantEmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface/50 p-6 text-center">
      <p className="text-sm font-medium text-foreground">
        LifeOS planning assistant
      </p>
      <p className="mt-2 text-sm text-muted">
        Ask LifeOS about your agenda, workload, tasks, availability, or planning
        proposals.
      </p>
      <p className="mt-3 text-xs text-muted">
        I use deterministic commands — not an AI chatbot. Type{" "}
        <span className="font-medium text-foreground">help</span> to see what I
        understand.
      </p>
    </div>
  );
}
