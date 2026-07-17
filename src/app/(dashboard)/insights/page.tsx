import Link from "next/link";
import { getProfile } from "@/lib/data/bootstrap";
import { loadInsights } from "@/lib/data/insights";
import { resolveInsightsRange } from "@/lib/analytics/date-ranges";
import { formatDurationMinutes } from "@/lib/analytics/metrics";
import { SimpleBarChart } from "@/components/insights/simple-bar-chart";
import { SectionCard } from "@/components/forms/ui";

type InsightsPageProps = {
  searchParams: Promise<{ range?: string; start?: string; end?: string }>;
};

export default async function InsightsPage({ searchParams }: InsightsPageProps) {
  const params = await searchParams;
  const profile = await getProfile();
  const weekStartsOn = profile.week_starts_on as 0 | 1;
  const preset = (params.range ?? "this_week") as
    | "this_week"
    | "last_week"
    | "last_4_weeks"
    | "custom";

  const range = resolveInsightsRange({
    preset,
    weekStartsOn,
    customStart: params.start,
    customEnd: params.end,
  });

  const insights = await loadInsights(range);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Insights
          </h1>
          <p className="mt-1 text-sm text-muted">{range.label}</p>
          <p className="mt-1 text-xs text-muted">
            Descriptive metrics only — no productivity score. Confidence notes
            appear under each card.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            ["this_week", "This week"],
            ["last_week", "Last week"],
            ["last_4_weeks", "Last 4 weeks"],
          ].map(([value, label]) => (
            <Link
              key={value}
              href={`/insights?range=${value}`}
              className={`inline-flex min-h-11 items-center rounded-lg px-3 py-1.5 ${
                preset === value
                  ? "bg-accent text-background"
                  : "bg-surface-elevated text-muted"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <SectionCard title="At a glance">
        <p className="text-sm text-foreground">
          {insights.completedTasks.value ?? 0} tasks completed
          {insights.liveTrackedMinutes.value != null
            ? ` · ${formatDurationMinutes(insights.liveTrackedMinutes.value)} live tracked`
            : ""}
          {insights.estimationAccuracy.value
            ? ` · estimation median ${insights.estimationAccuracy.value.medianRatio.toFixed(2)}×`
            : ""}
          .
        </p>
        {insights.estimationAccuracy.value ? (
          <p className="mt-2 text-xs text-muted">
            Trend cue:{" "}
            {insights.estimationAccuracy.value.medianRatio > 1.1
              ? "↑ often taking longer than estimates"
              : insights.estimationAccuracy.value.medianRatio < 0.9
                ? "↓ often finishing under estimates"
                : "→ estimates are roughly on target"}
          </p>
        ) : null}
      </SectionCard>

      <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-2">
        <SectionCard title="Live tracked time">
          <p className="text-2xl font-medium text-foreground">
            {insights.liveTrackedMinutes.value != null
              ? formatDurationMinutes(insights.liveTrackedMinutes.value)
              : "—"}
          </p>
          <p className="mt-1 text-xs text-muted">{insights.liveTrackedMinutes.description}</p>
          <p className="mt-1 text-xs text-muted">
            Confidence: {insights.liveTrackedMinutes.confidence.replace("_", " ")}
          </p>
        </SectionCard>

        <SectionCard title="Reviewed actual time">
          <p className="text-2xl font-medium text-foreground">
            {insights.reviewedActualMinutes.value != null
              ? formatDurationMinutes(insights.reviewedActualMinutes.value)
              : "—"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {insights.reviewedActualMinutes.description}
          </p>
        </SectionCard>

        <SectionCard title="Completed tasks">
          <p className="text-2xl font-medium text-foreground">
            {insights.completedTasks.value ?? 0}
          </p>
          <p className="mt-1 text-xs text-muted">{insights.completedTasks.description}</p>
        </SectionCard>

        <SectionCard title="Estimation accuracy">
          {insights.estimationAccuracy.value ? (
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="text-muted">Median ratio (actual / estimate)</dt>
                <dd className="font-medium text-foreground">
                  {insights.estimationAccuracy.value.medianRatio.toFixed(2)}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Underestimation frequency</dt>
                <dd className="font-medium text-foreground">
                  {Math.round(insights.estimationAccuracy.value.underestimateRate * 100)}%
                </dd>
              </div>
              <div>
                <dt className="text-muted">Overestimation frequency</dt>
                <dd className="font-medium text-foreground">
                  {Math.round(insights.estimationAccuracy.value.overestimateRate * 100)}%
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted">{insights.estimationAccuracy.description}</p>
          )}
          <p className="mt-2 text-xs text-muted">
            {insights.estimationAccuracy.excluded > 0
              ? `${insights.estimationAccuracy.excluded} records excluded from analysis.`
              : "No productivity score — descriptive metrics only."}
          </p>
        </SectionCard>

        <SectionCard title="Time by entry source">
          <SimpleBarChart
            ariaLabel="Tracked time by entry source"
            data={insights.hoursBySource.map((item) => ({
              label: item.source,
              value: item.minutes,
            }))}
            valueFormatter={(v) => formatDurationMinutes(v)}
          />
        </SectionCard>
      </div>
    </div>
  );
}
