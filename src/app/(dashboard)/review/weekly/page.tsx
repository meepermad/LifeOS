import { WeeklyReviewStepper } from "@/components/reviews/weekly-review-stepper";
import { loadWeeklyContext } from "@/lib/reviews/loaders";
import { formatAppDate } from "@/lib/dates/timezone";
import { resolveWeeklyReviewStepIndex } from "@/lib/notifications/deep-links";

type WeeklyReviewPageProps = {
  searchParams: Promise<{
    offset?: string;
    step?: string;
    weekStart?: string;
  }>;
};

export default async function WeeklyReviewPage({
  searchParams,
}: WeeklyReviewPageProps) {
  const params = await searchParams;
  const weekOffset = Number(params.offset ?? 0) || 0;
  const context = await loadWeeklyContext(weekOffset);
  const fallbackStep = context.session?.current_step ?? 0;
  const initialStepIndex = resolveWeeklyReviewStepIndex(
    params.step,
    fallbackStep,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Weekly review</h1>
        <p className="mt-1 text-sm text-muted">
          Week of {formatAppDate(context.weekStartDate, "MMMM d, yyyy")}
        </p>
      </div>

      <WeeklyReviewStepper
        context={context}
        weekOffset={weekOffset}
        initialStepIndex={initialStepIndex}
      />
    </div>
  );
}
