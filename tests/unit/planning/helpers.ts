import type { PlanningEvent, PlanningPreferences } from "@/lib/planning/types";

export const defaultPlanningPreferences: PlanningPreferences = {
  minimumBreakMinutes: 15,
  travelBufferMinutes: 15,
  planningBufferPercent: 20,
  preferredFocusBlockMinutes: 60,
  maximumFocusBlockMinutes: 120,
  avoidDifficultWorkAfter: null,
};

export function planningEvent(partial: Partial<PlanningEvent>): PlanningEvent {
  return {
    id: partial.id ?? "event-1",
    title: partial.title ?? "Event",
    startAt: partial.startAt ?? "2026-07-13T14:00:00.000Z",
    endAt: partial.endAt ?? "2026-07-13T16:00:00.000Z",
    allDay: partial.allDay ?? false,
    status: partial.status ?? "confirmed",
    eventType: partial.eventType ?? "meeting",
    blocksTime: partial.blocksTime ?? true,
    source: partial.source ?? "manual",
    relatedTaskId: partial.relatedTaskId ?? null,
  };
}

export const mondayAvailabilityRules = [
  {
    dayOfWeek: 1,
    availableStart: "09:00:00",
    availableEnd: "17:00:00",
    isEnabled: true,
  },
];
