import {
  CalendarGridSkeleton,
  LoadingStatus,
} from "@/components/ui/skeletons";

export default function CalendarLoading() {
  return (
    <div className="space-y-4">
      <LoadingStatus label="Loading calendar" />
      <div className="h-7 w-32 rounded-lg bg-surface-elevated motion-safe:animate-pulse" />
      <CalendarGridSkeleton />
    </div>
  );
}
