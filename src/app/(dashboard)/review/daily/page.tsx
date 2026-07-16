import { DailyReviewStepper } from "@/components/reviews/daily-review-stepper";
import {
  detectDailyPeriod,
  loadEveningContext,
  loadMorningContext,
} from "@/lib/reviews/loaders";
import { formatAppDate, nowInAppTimezone } from "@/lib/dates/timezone";
import { resolveDailyReviewStepIndex } from "@/lib/notifications/deep-links";

type DailyReviewPageProps = {
  searchParams: Promise<{
    period?: string;
    step?: string;
    focus?: string;
  }>;
};

export default async function DailyReviewPage({
  searchParams,
}: DailyReviewPageProps) {
  const params = await searchParams;
  const periodParam = params.period;
  const period =
    periodParam === "morning" || periodParam === "evening"
      ? periodParam
      : detectDailyPeriod();

  const context =
    period === "morning"
      ? await loadMorningContext()
      : await loadEveningContext();

  const today = nowInAppTimezone();
  const fallbackStep = context.session?.current_step ?? 0;
  const initialStepIndex = resolveDailyReviewStepIndex(
    period,
    params.step,
    fallbackStep,
  );
  const focusBlockId =
    typeof params.focus === "string" && params.focus.length > 0
      ? params.focus
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {period === "morning" ? "Morning review" : "Evening review"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {formatAppDate(today, "EEEE, MMMM d")}
        </p>
        <div className="mt-2 flex gap-3 text-xs">
          <a
            href="/review/daily?period=morning"
            className={
              period === "morning"
                ? "text-accent"
                : "text-muted hover:text-foreground"
            }
          >
            Morning
          </a>
          <a
            href="/review/daily?period=evening"
            className={
              period === "evening"
                ? "text-accent"
                : "text-muted hover:text-foreground"
            }
          >
            Evening
          </a>
        </div>
      </div>

      <DailyReviewStepper
        context={context}
        initialStepIndex={initialStepIndex}
        focusBlockId={focusBlockId}
      />
    </div>
  );
}
