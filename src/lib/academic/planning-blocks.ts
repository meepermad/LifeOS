import { toUtcEndOfAppLocalDay, toUtcFromAppLocalDate } from "@/lib/dates/timezone";
import { getActiveTerm } from "@/lib/academic/active-term";
import { getExceptionsBlockingAvailability } from "@/lib/academic/exception-filter";
import { listAcademicTerms } from "@/lib/data/academic/terms";
import { listExceptionsForTerm } from "@/lib/data/academic/exceptions";
import type { PlanningEvent } from "@/lib/planning/types";

export async function getAcademicBlockingEvents(
  dayKeys: string[],
): Promise<PlanningEvent[]> {
  const terms = await listAcademicTerms();
  const active = getActiveTerm(terms);
  if (!active) return [];

  const exceptions = await listExceptionsForTerm(active.id);
  const synthetic: PlanningEvent[] = [];

  for (const dateKey of dayKeys) {
    const blocking = getExceptionsBlockingAvailability(dateKey, exceptions);
    for (const exception of blocking) {
      synthetic.push({
        id: `academic-block:${exception.id}:${dateKey}`,
        title: exception.title,
        startAt: toUtcFromAppLocalDate(dateKey).toISOString(),
        endAt: toUtcEndOfAppLocalDay(dateKey).toISOString(),
        allDay: true,
        status: "confirmed",
        eventType: "other",
        blocksTime: true,
        source: "academic",
        relatedTaskId: null,
      });
    }
  }

  return synthetic;
}
