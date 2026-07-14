import {
  LoadingStatus,
  ReviewStepperSkeleton,
} from "@/components/ui/skeletons";

export default function DailyReviewLoading() {
  return (
    <div className="space-y-4">
      <LoadingStatus label="Loading daily review" />
      <div className="h-7 w-36 rounded-lg bg-surface-elevated motion-safe:animate-pulse" />
      <ReviewStepperSkeleton />
    </div>
  );
}
