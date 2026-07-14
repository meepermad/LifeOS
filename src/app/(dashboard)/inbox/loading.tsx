import {
  LoadingStatus,
  TaskRowSkeleton,
} from "@/components/ui/skeletons";

export default function InboxLoading() {
  return (
    <div className="space-y-4">
      <LoadingStatus label="Loading inbox" />
      <div className="h-7 w-24 rounded-lg bg-surface-elevated motion-safe:animate-pulse" />
      <TaskRowSkeleton count={4} />
    </div>
  );
}
