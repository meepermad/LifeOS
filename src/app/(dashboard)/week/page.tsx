import { redirect } from "next/navigation";
import { getAppLocalDateKey, getWeekBounds, nowInAppTimezone } from "@/lib/dates/timezone";
import { getProfile } from "@/lib/data/bootstrap";

type WeekPageProps = {
  searchParams: Promise<{ offset?: string }>;
};

export default async function WeekPage({ searchParams }: WeekPageProps) {
  const params = await searchParams;
  const weekOffset = Number(params.offset ?? 0) || 0;
  const profile = await getProfile();
  const weekStartsOn = profile.week_starts_on as 0 | 1;
  const reference = nowInAppTimezone();
  const { start } = getWeekBounds(reference, weekStartsOn, weekOffset);
  const date = getAppLocalDateKey(start);

  redirect(`/calendar?view=week&date=${date}`);
}
