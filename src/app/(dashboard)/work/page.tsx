import { WorkScheduleEditor } from "@/components/work/work-schedule-editor";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { getProfile } from "@/lib/data/bootstrap";
import {
  eventToShiftSlotDraft,
  listUnassignedWorkShifts,
  listWorkShiftsInRange,
} from "@/lib/data/work-shifts";
import { listActiveWorkProfiles } from "@/lib/data/work-profiles";
import { listWorkShiftTemplates } from "@/lib/data/work-templates";
import { getWeekBounds, getWeekDayKeys } from "@/lib/dates/timezone";
import type { DayShiftDraft } from "@/lib/work/shift-draft";

type Props = {
  searchParams: Promise<{ offset?: string }>;
};

export default async function WorkPage({ searchParams }: Props) {
  const user = await requireAllowedUser();
  const params = await searchParams;
  const weekOffset = Number.parseInt(params.offset ?? "0", 10) || 0;
  const profile = await getProfile();
  const bounds = getWeekBounds(new Date(), profile.week_starts_on as 0 | 1, weekOffset);
  const dayKeys = getWeekDayKeys(bounds.start, profile.week_starts_on as 0 | 1);
  const weekStartKey = dayKeys[0]!;

  const [existingShifts, templates, workProfiles, unassignedShifts] = await Promise.all([
    listWorkShiftsInRange(bounds.start.toISOString(), bounds.end.toISOString()),
    listWorkShiftTemplates(),
    listActiveWorkProfiles(),
    listUnassignedWorkShifts(),
  ]);

  const initialDays: DayShiftDraft[] = dayKeys.map((dateKey) => {
    const shifts = existingShifts
      .map(eventToShiftSlotDraft)
      .filter((shift) => shift.dateKey === dateKey);
    return { dateKey, shifts };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Work schedule</h1>
        <p className="mt-1 text-sm text-muted">
          Enter your weekly shifts. Review before saving. Multiple shifts per day are supported.
        </p>
      </div>

      <WorkScheduleEditor
        userId={user.id}
        weekStartKey={weekStartKey}
        weekOffset={weekOffset}
        dayKeys={dayKeys}
        initialDays={initialDays}
        templates={templates}
        workProfiles={workProfiles}
        unassignedShiftIds={unassignedShifts.map((shift) => shift.id)}
        existingShifts={existingShifts}
      />
    </div>
  );
}
