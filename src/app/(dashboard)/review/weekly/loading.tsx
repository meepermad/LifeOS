import {
  LoadingStatus,
  ReviewStepperSkeleton,
} from "@/components/ui/skeletons";

export default function WeeklyReviewLoading() {
  return (
    <div className="space-y-4">
      <LoadingStatus label="Loading weekly review" />
      <div className="h-7 w-40 rounded-lg bg-surface-elevated motion-safe:animate-pulse" />
      <ReviewStepperSkeleton />
    </div>
  );
}
