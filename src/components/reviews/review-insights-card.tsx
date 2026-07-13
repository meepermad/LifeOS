import type { ReviewInsight } from "@/lib/reviews/types";

export function ReviewInsightsCard({
  title = "Summary",
  insights,
}: {
  title?: string;
  insights: ReviewInsight[];
}) {
  if (insights.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      <ul className="space-y-2">
        {insights.map((insight) => (
          <li
            key={insight.id}
            className="rounded-lg border border-border/60 bg-surface-elevated/40 px-3 py-2 text-sm text-foreground"
          >
            {insight.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
