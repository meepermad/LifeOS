import {
  LoadingStatus,
  TaskRowSkeleton,
} from "@/components/ui/skeletons";

export default function RecurringLoading() {
  return (
    <div className="space-y-4">
      <LoadingStatus label="Loading recurring tasks" />
      <div className="h-7 w-40 rounded-lg bg-surface-elevated motion-safe:animate-pulse" />
      <TaskRowSkeleton count={4} />
    </div>
  );
}
