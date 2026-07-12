import type { AcademicTermRow } from "@/types/domain";

export function getActiveTerm(
  terms: AcademicTermRow[],
): AcademicTermRow | null {
  return terms.find((term) => term.status === "active") ?? null;
}

export function getCurrentSemesterTerm(
  terms: AcademicTermRow[],
  dateKey: string,
): AcademicTermRow | null {
  const active = terms.filter(
    (term) =>
      term.status === "active" &&
      dateKey >= term.start_date &&
      dateKey <= term.end_date,
  );
  if (active.length === 1) return active[0];
  if (active.length > 1) {
    return active.find((term) => dateKey >= term.classes_start && dateKey <= term.classes_end) ?? active[0];
  }

  return (
    terms.find(
      (term) =>
        term.status !== "archived" &&
        dateKey >= term.classes_start &&
        dateKey <= term.classes_end,
    ) ?? null
  );
}

export function getNextSemesterTerm(
  terms: AcademicTermRow[],
  dateKey: string,
): AcademicTermRow | null {
  const sorted = [...terms]
    .filter((term) => term.status !== "archived" && term.classes_start > dateKey)
    .sort((a, b) => a.classes_start.localeCompare(b.classes_start));
  return sorted[0] ?? null;
}

export function listNonArchivedTerms(
  terms: AcademicTermRow[],
): AcademicTermRow[] {
  return terms
    .filter((term) => term.status !== "archived")
    .sort((a, b) => a.classes_start.localeCompare(b.classes_start));
}
