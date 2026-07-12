export type AcademicOccurrenceAction =
  | "edit_meeting"
  | "cancel_occurrence"
  | "alter_occurrence";

export function buildSchoolOccurrenceUrl(input: {
  termId?: string;
  courseId?: string;
  action: AcademicOccurrenceAction;
  dateKey?: string;
}): string {
  const params = new URLSearchParams();
  if (input.termId) params.set("term", input.termId);
  if (input.courseId) params.set("course", input.courseId);
  params.set("action", input.action);
  if (input.dateKey) params.set("date", input.dateKey);
  return `/school?${params.toString()}`;
}

export const ACADEMIC_EVENT_HELP_TEXT =
  "Managed in School — changes apply after you save and reconcile on the School page.";
