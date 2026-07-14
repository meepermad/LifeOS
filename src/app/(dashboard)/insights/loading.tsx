import {
  InsightsSkeleton,
  LoadingStatus,
} from "@/components/ui/skeletons";

export default function InsightsLoading() {
  return (
    <div className="space-y-4">
      <LoadingStatus label="Loading insights" />
      <div className="h-7 w-28 rounded-lg bg-surface-elevated motion-safe:animate-pulse" />
      <InsightsSkeleton />
    </div>
  );
}
