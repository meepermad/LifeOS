import {
  LoadingStatus,
  SettingsCardSkeleton,
} from "@/components/ui/skeletons";

export default function SettingsSectionLoading() {
  return (
    <div className="space-y-4">
      <LoadingStatus label="Loading settings section" />
      <div className="h-4 w-24 rounded bg-surface-elevated motion-safe:animate-pulse" />
      <div className="h-7 w-40 rounded-lg bg-surface-elevated motion-safe:animate-pulse" />
      <SettingsCardSkeleton count={2} />
    </div>
  );
}
