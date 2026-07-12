import { WorkScheduleEditor } from "@/components/work/work-schedule-editor";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { getProfile } from "@/lib/data/bootstrap";
import { eventToShiftDayDraft, listWorkShiftsInRange } from "@/lib/data/work-shifts";
import { listWorkShiftTemplates } from "@/lib/data/work-templates";
import { getWeekBounds, getWeekDayKeys } from "@/lib/dates/timezone";
import type { ShiftDayDraft } from "@/lib/work/shift-draft";

type Props = {
  searchParams: Promise<{ offset?: string }>;
};

export default async function WorkPage({ searchParams }: Props) {
  await requireAllowedUser();
  const params = await searchParams;
  const weekOffset = Number.parseInt(params.offset ?? "0", 10) || 0;
  const profile = await getProfile();
  const bounds = getWeekBounds(new Date(), profile.week_starts_on as 0 | 1, weekOffset);
  const dayKeys = getWeekDayKeys(bounds.start, profile.week_starts_on as 0 | 1);
  const weekStartKey = dayKeys[0]!;

  const [existingShifts, templates] = await Promise.all([
    listWorkShiftsInRange(bounds.start.toISOString(), bounds.end.toISOString()),
    listWorkShiftTemplates(),
  ]);

  const shiftByDate = new Map(
    existingShifts.map((shift) => {
      const dateKey =
        shift.external_event_id?.replace("work-shift:", "") ??
        shift.start_at.slice(0, 10);
      return [dateKey, shift];
    }),
  );

  const initialDays: ShiftDayDraft[] = dayKeys.map((dateKey) => {
    const existing = shiftByDate.get(dateKey);
    if (!existing) {
      return {
        dateKey,
        isOff: true,
        startTime: "",
        endTime: "",
        unpaidBreakMinutes: 0,
        location: "",
        note: "",
      };
    }
    return eventToShiftDayDraft(existing);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Work schedule</h1>
        <p className="mt-1 text-sm text-muted">
          Enter your weekly shifts. Review before saving.
        </p>
      </div>

      <WorkScheduleEditor
        weekStartKey={weekStartKey}
        weekOffset={weekOffset}
        dayKeys={dayKeys}
        initialDays={initialDays}
        templates={templates}
        existingShifts={existingShifts}
      />
    </div>
  );
}
