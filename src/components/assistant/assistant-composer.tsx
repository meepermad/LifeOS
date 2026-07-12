"use client";

type AssistantComposerProps = {
  onSend: (text: string) => void;
  disabled?: boolean;
  loading?: boolean;
};

export function AssistantComposer({
  onSend,
  disabled,
  loading,
}: AssistantComposerProps) {
  function handleSubmit(formData: FormData) {
    const text = String(formData.get("message") ?? "").trim();
    if (!text) return;
    onSend(text);
  }

  return (
    <form action={handleSubmit} className="flex gap-2">
      <label htmlFor="assistant-message" className="sr-only">
        Message
      </label>
      <input
        id="assistant-message"
        name="message"
        type="text"
        autoComplete="off"
        disabled={disabled || loading}
        placeholder="Ask about your schedule, workload, or plans…"
        className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent disabled:opacity-50"
        maxLength={2000}
      />
      <button
        type="submit"
        disabled={disabled || loading}
        className="shrink-0 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {loading ? "…" : "Send"}
      </button>
    </form>
  );
}
