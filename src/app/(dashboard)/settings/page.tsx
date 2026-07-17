import { redirect } from "next/navigation";
import { SettingsHub } from "@/components/settings/settings-hub";
import { mapLegacySettingsSection } from "@/lib/settings/sections";

type SettingsPageProps = {
  searchParams: Promise<{ section?: string }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const mapped = mapLegacySettingsSection(params.section);
  if (mapped) {
    redirect(`/settings/${mapped}`);
  }

  return <SettingsHub />;
}
