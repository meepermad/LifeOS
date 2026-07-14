import {
  LoadingStatus,
  SettingsCardSkeleton,
} from "@/components/ui/skeletons";

export default function StatusLoading() {
  return (
    <div className="space-y-4">
      <LoadingStatus label="Loading status" />
      <div className="h-7 w-36 rounded-lg bg-surface-elevated motion-safe:animate-pulse" />
      <SettingsCardSkeleton count={4} />
    </div>
  );
}
