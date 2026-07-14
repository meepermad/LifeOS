import type { EventWithCalendar } from "@/lib/data/events";
import { formatAppDate, formatAppTimeRange } from "@/lib/dates/timezone";
import type { ParsedShift } from "@/lib/work/shift-validation";

export function formatShiftDurationMinutes(
  startAt: string,
  endAt: string,
  unpaidBreakMinutes = 0,
): { scheduledMinutes: number; workedMinutes: number; label: string } {
  const scheduledMinutes = Math.round(
    (new Date(endAt).getTime() - new Date(startAt).getTime()) / 60_000,
  );
  const workedMinutes = Math.max(0, scheduledMinutes - unpaidBreakMinutes);
  const hours = workedMinutes / 60;
  const label =
    hours === 1
      ? "1 hour"
      : Number.isInteger(hours)
        ? `${hours} hours`
        : `${hours.toFixed(1).replace(/\.0$/, "")} hours`;
  return { scheduledMinutes, workedMinutes, label };
}

export function formatShiftPreviewLine(shift: ParsedShift): string {
  const dateLabel = formatAppDate(shift.startAt);
  const timeLabel = formatAppTimeRange(shift.startAt, shift.endAt);
  const { label } = formatShiftDurationMinutes(
    shift.startAt,
    shift.endAt,
    shift.unpaidBreakMinutes,
  );
  const overnight = shift.isOvernight ? " (overnight)" : "";
  return `${dateLabel}\n${timeLabel}${overnight}\n${label}\n${shift.title}`;
}

export function formatShiftPreviewList(shifts: ParsedShift[]): string {
  return shifts.map(formatShiftPreviewLine).join("\n\n");
}

export type WorkHoursSummary = {
  scheduledMinutes: number;
  workedMinutes: number;
  shiftCount: number;
  averageShiftMinutes: number;
  earliestStart: string | null;
  latestEnd: string | null;
  byDay: Record<string, { scheduledMinutes: number; workedMinutes: number }>;
  byProfile: Record<string, {
    displayName: string;
    scheduledMinutes: number;
    workedMinutes: number;
    shiftCount: number;
    averageShiftMinutes: number;
  }>;
};

export function calculateWorkHours(
  events: EventWithCalendar[],
  profileDisplayNames: Record<string, string> = {},
): WorkHoursSummary {
  const byDay: Record<string, { scheduledMinutes: number; workedMinutes: number }> =
    {};
  let scheduledMinutes = 0;
  let workedMinutes = 0;
  let earliestStart: string | null = null;
  let latestEnd: string | null = null;
  const byProfile: WorkHoursSummary["byProfile"] = {};

  for (const event of events) {
    if (event.status === "cancelled") continue;
    const { scheduledMinutes: sched, workedMinutes: worked } =
      formatShiftDurationMinutes(
        event.start_at,
        event.end_at,
        event.unpaid_break_minutes ?? 0,
      );
    scheduledMinutes += sched;
    workedMinutes += worked;

    const dateKey = event.start_at.slice(0, 10);
    if (!byDay[dateKey]) {
      byDay[dateKey] = { scheduledMinutes: 0, workedMinutes: 0 };
    }
    byDay[dateKey].scheduledMinutes += sched;
    byDay[dateKey].workedMinutes += worked;

    const profileKey = event.work_profile_id ?? "unassigned";
    const profile = (byProfile[profileKey] ??= {
      displayName:
        profileKey === "unassigned"
          ? "Unassigned work"
          : profileDisplayNames[profileKey] ?? event.title,
      scheduledMinutes: 0,
      workedMinutes: 0,
      shiftCount: 0,
      averageShiftMinutes: 0,
    });
    profile.scheduledMinutes += sched;
    profile.workedMinutes += worked;
    profile.shiftCount += 1;

    if (!earliestStart || event.start_at < earliestStart) {
      earliestStart = event.start_at;
    }
    if (!latestEnd || event.end_at > latestEnd) {
      latestEnd = event.end_at;
    }
  }

  const shiftCount = events.filter((e) => e.status !== "cancelled").length;
  for (const profile of Object.values(byProfile)) {
    profile.averageShiftMinutes =
      profile.shiftCount > 0 ? profile.workedMinutes / profile.shiftCount : 0;
  }

  return {
    scheduledMinutes,
    workedMinutes,
    shiftCount,
    averageShiftMinutes: shiftCount > 0 ? workedMinutes / shiftCount : 0,
    earliestStart,
    latestEnd,
    byDay,
    byProfile,
  };
}

export function formatHoursMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours}`;
  if (hours === 0) return `${minutes} minutes`;
  return `${hours} and a half`.replace(
    "and a half",
    minutes === 30 ? "and a half" : `${minutes} minutes`,
  );
}

export function formatWorkHoursSpoken(summary: WorkHoursSummary): string {
  const hours = summary.workedMinutes / 60;
  if (hours === 0) return "You have no scheduled work hours.";
  const total =
    Number.isInteger(hours)
      ? `You work ${hours} hour${hours === 1 ? "" : "s"} this week.`
      : `You work ${hours.toFixed(1)} hours this week.`;
  const byJob = Object.values(summary.byProfile);
  if (byJob.length <= 1) return total;
  const parts = byJob.map((profile) => {
    const profileHours = profile.workedMinutes / 60;
    const label = Number.isInteger(profileHours)
      ? `${profileHours}`
      : profileHours.toFixed(1);
    return `${profile.displayName}: ${label}`;
  });
  return `${total} By job: ${parts.join("; ")}.`;
}
