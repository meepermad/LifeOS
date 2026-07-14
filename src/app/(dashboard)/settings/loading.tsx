import {
  LoadingStatus,
  SettingsCardSkeleton,
} from "@/components/ui/skeletons";

export default function SettingsLoading() {
  return (
    <div className="space-y-4">
      <LoadingStatus label="Loading settings" />
      <div className="h-7 w-28 rounded-lg bg-surface-elevated motion-safe:animate-pulse" />
      <SettingsCardSkeleton count={4} />
    </div>
  );
}
