import {
  LoadingStatus,
  WorkWeekSkeleton,
} from "@/components/ui/skeletons";

export default function WorkLoading() {
  return (
    <div className="space-y-4">
      <LoadingStatus label="Loading work schedule" />
      <WorkWeekSkeleton />
    </div>
  );
}
