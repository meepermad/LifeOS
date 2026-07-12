import { listAcademicTerms } from "@/lib/data/academic/terms";
import { listExceptionsForTerm } from "@/lib/data/academic/exceptions";
import { getActiveTerm, getCurrentSemesterTerm } from "@/lib/academic/active-term";
import { findExceptionByPhrase } from "@/lib/academic/exception-filter";
import { getAppLocalDateKey, nowInAppTimezone } from "@/lib/dates/timezone";
import type { DateRangeRef } from "@/lib/assistant/intents";

export async function resolveAcademicPeriodRange(
  periodKind: string,
): Promise<DateRangeRef | null> {
  const terms = await listAcademicTerms();
  const nonArchived = terms.filter((term) => term.status !== "archived");
  const active = getActiveTerm(nonArchived) ?? getCurrentSemesterTerm(
    nonArchived,
    getAppLocalDateKey(nowInAppTimezone()),
  );
  if (!active) return null;

  const exceptions = await listExceptionsForTerm(active.id);
  const exception = findExceptionByPhrase(periodKind, exceptions);

  if (exception) {
    return {
      phrase: periodKind,
      startDateKey: exception.start_date,
      endDateKey: exception.end_date,
      label: exception.title,
    };
  }

  if (/\bfinals week\b/i.test(periodKind) && active.finals_start && active.finals_end) {
    return {
      phrase: "finals week",
      startDateKey: active.finals_start,
      endDateKey: active.finals_end,
      label: "Finals Week",
    };
  }

  return null;
}
