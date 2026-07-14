import {
  GenericPageSkeleton,
  SettingsCardSkeleton,
} from "@/components/ui/skeletons";

export default function SchoolLoading() {
  return (
    <GenericPageSkeleton titleWidth="w-28">
      <SettingsCardSkeleton count={3} />
    </GenericPageSkeleton>
  );
}
