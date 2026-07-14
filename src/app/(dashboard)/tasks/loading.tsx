import {
  LoadingStatus,
  TaskRowSkeleton,
} from "@/components/ui/skeletons";

export default function TasksLoading() {
  return (
    <div className="space-y-4">
      <LoadingStatus label="Loading tasks" />
      <div className="h-7 w-24 rounded-lg bg-surface-elevated motion-safe:animate-pulse" />
      <TaskRowSkeleton count={6} />
    </div>
  );
}
