import {
  GenericPageSkeleton,
  SettingsCardSkeleton,
} from "@/components/ui/skeletons";

export default function ImportsLoading() {
  return (
    <GenericPageSkeleton titleWidth="w-24">
      <SettingsCardSkeleton count={2} />
    </GenericPageSkeleton>
  );
}
