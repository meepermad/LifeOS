"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { z } from "zod";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { AppError } from "@/lib/errors/app-error";
import { expandAllMeetings, computeOccurrenceContentHash } from "@/lib/academic/meeting-expansion";
import { classifyCanvasMeetingCandidates } from "@/lib/academic/canvas-candidates";
import {
  buildTermFromPreset,
  mergePresetExceptions,
} from "@/lib/academic/preset-apply";
import { detectSemesterConflicts } from "@/lib/academic/semester-conflicts";
import { reconcileSemesterOccurrences } from "@/lib/academic/semester-reconciliation";
import { listAcademicPresets } from "@/lib/academic/presets";
import {
  applySemesterReconciliation,
  listAllAcademicClassEventsForTerm,
} from "@/lib/data/academic/class-events";
import {
  createCourse,
  deleteCourse,
  listCoursesForTerm,
  updateCourse,
} from "@/lib/data/academic/courses";
import {
  createAcademicException,
  deleteAcademicException,
  insertPresetExceptions,
  listExceptionsForTerm,
  updateAcademicException,
} from "@/lib/data/academic/exceptions";
import {
  createClassMeeting,
  deleteClassMeeting,
  listLinkedCanvasUids,
  listMeetingsForTerm,
  updateClassMeeting,
} from "@/lib/data/academic/meetings";
import {
  archiveAcademicTerm,
  createAcademicTerm,
  getAcademicTermById,
  listAcademicTerms,
  setActiveAcademicTerm,
  updateAcademicTerm,
} from "@/lib/data/academic/terms";
import { getCanvasCalendar } from "@/lib/data/calendars";
import { listEventsInRange } from "@/lib/data/events";
import {
  academicExceptionSchema,
  academicTermSchema,
  canvasResolutionModeSchema,
  classMeetingSchema,
  courseSchema,
  getExceptionTypeDefaults,
  semesterSaveSchema,
} from "@/lib/validation/academic";
import {
  candidateFingerprint,
  createCanvasLinkDecision,
  listActiveCanvasLinkDecisions,
  listIgnoredCandidateFingerprints,
  previewSuppressionUids,
  reverseCanvasLinkDecision,
} from "@/lib/data/academic/canvas-links";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

function toActionError<T = void>(error: unknown): ActionResult<T> {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "form";
      fieldErrors[key] = issue.message;
    }
    return { success: false, error: "Validation failed", fieldErrors };
  }
  if (error instanceof AppError) {
    return { success: false, error: error.message };
  }
  if (error instanceof Error) {
    return { success: false, error: error.message };
  }
  return { success: false, error: "An unexpected error occurred" };
}

const createTermSchema = academicTermSchema;
const applyPresetSchema = z.object({
  presetKey: z.string(),
  termKey: z.string(),
});

export async function getSchoolPageDataAction(): Promise<
  ActionResult<{
    terms: Awaited<ReturnType<typeof listAcademicTerms>>;
    presets: ReturnType<typeof listAcademicPresets>;
    activeTermId: string | null;
  }>
> {
  try {
    await requireAllowedUser();
    const terms = await listAcademicTerms();
    const active = terms.find((term) => term.status === "active");
    return {
      success: true,
      data: {
        terms,
        presets: listAcademicPresets(),
        activeTermId: active?.id ?? null,
      },
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function getTermDetailsAction(termId: string): Promise<
  ActionResult<{
    term: NonNullable<Awaited<ReturnType<typeof getAcademicTermById>>>;
    courses: Awaited<ReturnType<typeof listCoursesForTerm>>;
    meetings: Awaited<ReturnType<typeof listMeetingsForTerm>>;
    exceptions: Awaited<ReturnType<typeof listExceptionsForTerm>>;
    candidates: ReturnType<typeof classifyCanvasMeetingCandidates>;
    linkDecisions: Awaited<ReturnType<typeof listActiveCanvasLinkDecisions>>;
  }>
> {
  try {
    await requireAllowedUser();
    const term = await getAcademicTermById(termId);
    if (!term) {
      return { success: false, error: "Term not found" };
    }

    const [courses, meetings, exceptions, linkedUids, ignored, linkDecisions] =
      await Promise.all([
      listCoursesForTerm(termId),
      listMeetingsForTerm(termId),
      listExceptionsForTerm(termId),
      listLinkedCanvasUids(),
      listIgnoredCandidateFingerprints(termId),
      listActiveCanvasLinkDecisions(termId),
    ]);

    let candidates: ReturnType<typeof classifyCanvasMeetingCandidates> = [];
    try {
      const canvasCalendar = await getCanvasCalendar();
      const canvasEvents = await listEventsInRange(
        `${term.classes_start}T00:00:00.000Z`,
        `${term.classes_end}T23:59:59.999Z`,
      );
      const schoolEvents = await listAllAcademicClassEventsForTerm(
        term.classes_start,
        term.classes_end,
      );
      candidates = classifyCanvasMeetingCandidates({
        canvasClassEvents: canvasEvents.filter(
          (event) => event.calendar_id === canvasCalendar.id,
        ),
        linkedCanvasUids: linkedUids,
        existingSchoolEvents: schoolEvents,
      }).filter((candidate) => !ignored.has(candidateFingerprint(candidate)));
    } catch {
      candidates = [];
    }

    return {
      success: true,
      data: { term, courses, meetings, exceptions, candidates, linkDecisions },
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createTermAction(
  input: z.infer<typeof createTermSchema>,
): Promise<ActionResult<{ termId: string }>> {
  try {
    await requireAllowedUser();
    const parsed = createTermSchema.parse(input);
    const term = await createAcademicTerm({
      name: parsed.name,
      institution: parsed.institution,
      term_type: parsed.termType,
      start_date: parsed.startDate,
      end_date: parsed.endDate,
      classes_start: parsed.classesStart,
      classes_end: parsed.classesEnd,
      finals_start: parsed.finalsStart ?? null,
      finals_end: parsed.finalsEnd ?? null,
      timezone: parsed.timezone,
      status: parsed.status,
      source_preset_key: null,
      source_preset_revision: null,
      source_preset_imported_at: null,
      source_metadata: null,
    });
    revalidatePath("/school");
    return { success: true, data: { termId: term.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function applyPresetAction(
  input: z.infer<typeof applyPresetSchema>,
): Promise<ActionResult<{ termId: string }>> {
  try {
    await requireAllowedUser();
    const parsed = applyPresetSchema.parse(input);
    const built = buildTermFromPreset({
      presetKey: parsed.presetKey,
      termKey: parsed.termKey,
      importedAt: new Date().toISOString(),
    });
    if (!built) {
      return { success: false, error: "Preset not found" };
    }

    const term = await createAcademicTerm({
      ...built.term,
      name: built.term.name!,
      institution: built.term.institution!,
      term_type: built.term.term_type!,
      start_date: built.term.start_date!,
      end_date: built.term.end_date!,
      classes_start: built.term.classes_start!,
      classes_end: built.term.classes_end!,
      finals_start: built.term.finals_start ?? null,
      finals_end: built.term.finals_end ?? null,
      timezone: built.term.timezone!,
      status: "draft",
      source_preset_key: built.term.source_preset_key ?? null,
      source_preset_revision: built.term.source_preset_revision ?? null,
      source_preset_imported_at: built.term.source_preset_imported_at ?? null,
      source_metadata: built.term.source_metadata ?? null,
    });

    await insertPresetExceptions(term.id, built.exceptions);
    revalidatePath("/school");
    return { success: true, data: { termId: term.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateTermAction(
  termId: string,
  input: z.infer<typeof createTermSchema>,
): Promise<ActionResult> {
  try {
    await requireAllowedUser();
    const parsed = createTermSchema.parse(input);
    await updateAcademicTerm(termId, {
      name: parsed.name,
      institution: parsed.institution,
      term_type: parsed.termType,
      start_date: parsed.startDate,
      end_date: parsed.endDate,
      classes_start: parsed.classesStart,
      classes_end: parsed.classesEnd,
      finals_start: parsed.finalsStart ?? null,
      finals_end: parsed.finalsEnd ?? null,
      timezone: parsed.timezone,
      status: parsed.status,
    });
    revalidatePath("/school");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function activateTermAction(termId: string): Promise<ActionResult> {
  try {
    await requireAllowedUser();
    await setActiveAcademicTerm(termId);
    revalidatePath("/school");
    revalidatePath("/today");
    revalidatePath("/week");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function archiveTermAction(termId: string): Promise<ActionResult> {
  try {
    await requireAllowedUser();
    await archiveAcademicTerm(termId);
    revalidatePath("/school");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function saveCourseAction(
  termId: string,
  input: z.infer<typeof courseSchema> & { courseId?: string },
): Promise<ActionResult<{ courseId: string }>> {
  try {
    await requireAllowedUser();
    const parsed = courseSchema.parse(input);
    if (input.courseId) {
      const course = await updateCourse(input.courseId, {
        code: parsed.code,
        name: parsed.name,
        section: parsed.section ?? null,
        color: parsed.color ?? null,
      });
      revalidatePath("/school");
      return { success: true, data: { courseId: course.id } };
    }
    const course = await createCourse({
      academic_term_id: termId,
      code: parsed.code,
      name: parsed.name,
      section: parsed.section ?? null,
      color: parsed.color ?? null,
    });
    revalidatePath("/school");
    return { success: true, data: { courseId: course.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteCourseAction(courseId: string): Promise<ActionResult> {
  try {
    await requireAllowedUser();
    await deleteCourse(courseId);
    revalidatePath("/school");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function saveMeetingAction(
  courseId: string,
  input: z.infer<typeof classMeetingSchema> & { meetingId?: string },
): Promise<ActionResult<{ meetingId: string }>> {
  try {
    await requireAllowedUser();
    const parsed = classMeetingSchema.parse(input);
    const contentHash = computeOccurrenceContentHash({
      title: courseId,
      startAt: parsed.startTime,
      endAt: parsed.endTime,
      location: parsed.location ?? null,
      isOnline: parsed.isOnline,
    });
    if (input.meetingId) {
      const meeting = await updateClassMeeting(input.meetingId, {
        days_of_week: parsed.daysOfWeek,
        start_time: parsed.startTime,
        end_time: parsed.endTime,
        effective_start_date: parsed.effectiveStartDate,
        effective_end_date: parsed.effectiveEndDate,
        location: parsed.location ?? null,
        is_online: parsed.isOnline,
        timezone: parsed.timezone,
        source_canvas_uid: parsed.sourceCanvasUid ?? null,
        content_hash: contentHash,
      });
      revalidatePath("/school");
      return { success: true, data: { meetingId: meeting.id } };
    }
    const meeting = await createClassMeeting({
      course_id: courseId,
      days_of_week: parsed.daysOfWeek,
      start_time: parsed.startTime,
      end_time: parsed.endTime,
      effective_start_date: parsed.effectiveStartDate,
      effective_end_date: parsed.effectiveEndDate,
      location: parsed.location ?? null,
      is_online: parsed.isOnline,
      timezone: parsed.timezone,
      source_canvas_uid: parsed.sourceCanvasUid ?? null,
      content_hash: contentHash,
    });
    revalidatePath("/school");
    return { success: true, data: { meetingId: meeting.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteMeetingAction(meetingId: string): Promise<ActionResult> {
  try {
    await requireAllowedUser();
    await deleteClassMeeting(meetingId);
    revalidatePath("/school");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function saveExceptionAction(
  termId: string,
  input: z.infer<typeof academicExceptionSchema> & { exceptionId?: string },
): Promise<ActionResult<{ exceptionId: string }>> {
  try {
    await requireAllowedUser();
    const parsed = academicExceptionSchema.parse(input);
    if (input.exceptionId) {
      const exception = await updateAcademicException(input.exceptionId, {
        exception_type: parsed.exceptionType,
        start_date: parsed.startDate,
        end_date: parsed.endDate,
        course_id: parsed.courseId ?? null,
        suppresses_classes: parsed.suppressesClasses,
        blocks_availability: parsed.blocksAvailability,
        informational_only: parsed.informationalOnly,
        title: parsed.title,
        notes: parsed.notes ?? null,
        altered_schedule: (parsed.alteredSchedule ?? null) as import("@/types/database.types").Json,
        preset_key: parsed.presetKey ?? null,
      });
      revalidatePath("/school");
      return { success: true, data: { exceptionId: exception.id } };
    }
    const defaults = getExceptionTypeDefaults(parsed.exceptionType);
    const suppressesClasses = parsed.isUserModified
      ? parsed.suppressesClasses
      : defaults.suppressesClasses;
    const blocksAvailability = parsed.isUserModified
      ? parsed.blocksAvailability
      : defaults.blocksAvailability;
    const informationalOnly = parsed.isUserModified
      ? parsed.informationalOnly
      : defaults.informationalOnly;
    const exception = await createAcademicException({
      academic_term_id: termId,
      exception_type: parsed.exceptionType,
      start_date: parsed.startDate,
      end_date: parsed.endDate,
      course_id: parsed.courseId ?? null,
      suppresses_classes: suppressesClasses,
      blocks_availability: blocksAvailability,
      informational_only: informationalOnly,
      title: parsed.title,
      notes: parsed.notes ?? null,
      altered_schedule: (parsed.alteredSchedule ?? null) as import("@/types/database.types").Json,
      preset_key: parsed.presetKey ?? null,
      is_user_modified: parsed.isUserModified,
    });
    revalidatePath("/school");
    return { success: true, data: { exceptionId: exception.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteExceptionAction(
  exceptionId: string,
): Promise<ActionResult> {
  try {
    await requireAllowedUser();
    await deleteAcademicException(exceptionId);
    revalidatePath("/school");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export async function previewCanvasCandidateResolutionAction(input: {
  candidate: {
    id: string;
    title: string;
    sourceCanvasUids: string[];
    occurrenceCount: number;
    startTime: string;
    endTime: string;
  };
}): Promise<
  ActionResult<{
    suppressionCount: number;
    suppressionUids: string[];
    previewLines: string[];
  }>
> {
  try {
    await requireAllowedUser();
    const uids = previewSuppressionUids({
      id: input.candidate.id,
      title: input.candidate.title,
      sourceCanvasUids: input.candidate.sourceCanvasUids,
      occurrenceCount: input.candidate.occurrenceCount,
    } as never);
    return {
      success: true,
      data: {
        suppressionCount: uids.length,
        suppressionUids: uids,
        previewLines: [
          `${uids.length} Canvas class occurrence${uids.length === 1 ? "" : "s"} would be suppressed`,
          `${input.candidate.title} (${input.candidate.startTime}–${input.candidate.endTime})`,
        ],
      },
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function resolveCanvasCandidateAction(input: {
  termId: string;
  resolutionMode: z.infer<typeof canvasResolutionModeSchema>;
  candidate: {
    id: string;
    title: string;
    courseCode: string | null;
    daysOfWeek: number[];
    startTime: string;
    endTime: string;
    effectiveStartDate: string;
    effectiveEndDate: string;
    location: string | null;
    sourceCanvasUids: string[];
    occurrenceCount: number;
  };
}): Promise<ActionResult> {
  try {
    await requireAllowedUser();
    const resolutionMode = canvasResolutionModeSchema.parse(input.resolutionMode);
    const term = await getAcademicTermById(input.termId);
    if (!term) return { success: false, error: "Term not found" };

    const fingerprint = candidateFingerprint(input.candidate as never);

    if (resolutionMode === "ignored") {
      await createCanvasLinkDecision({
        termId: term.id,
        classMeetingId: null,
        resolutionMode: "ignored",
        candidateFingerprint: fingerprint,
        canvasUids: input.candidate.sourceCanvasUids,
      });
      revalidatePath("/school");
      return { success: true };
    }

    const course = await createCourse({
      academic_term_id: term.id,
      code: input.candidate.courseCode ?? "",
      name: input.candidate.title,
      section: null,
      color: null,
    });

    const meeting = await createClassMeeting({
      course_id: course.id,
      days_of_week: input.candidate.daysOfWeek,
      start_time: input.candidate.startTime,
      end_time: input.candidate.endTime,
      effective_start_date: input.candidate.effectiveStartDate,
      effective_end_date: input.candidate.effectiveEndDate,
      location: input.candidate.location,
      is_online: false,
      timezone: term.timezone,
      source_canvas_uid: input.candidate.sourceCanvasUids[0] ?? null,
      content_hash: null,
    });

    const suppressUids =
      resolutionMode === "link_suppress"
        ? previewSuppressionUids(input.candidate as never)
        : [];

    await createCanvasLinkDecision({
      termId: term.id,
      classMeetingId: meeting.id,
      resolutionMode,
      candidateFingerprint: fingerprint,
      canvasUids: input.candidate.sourceCanvasUids,
      suppressUids,
    });

    revalidatePath("/school");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** @deprecated Use resolveCanvasCandidateAction */
export async function acceptCanvasCandidateAction(input: {
  termId: string;
  candidate: {
    title: string;
    courseCode: string | null;
    daysOfWeek: number[];
    startTime: string;
    endTime: string;
    effectiveStartDate: string;
    effectiveEndDate: string;
    location: string | null;
    sourceCanvasUids: string[];
    id?: string;
    occurrenceCount?: number;
  };
}): Promise<ActionResult> {
  return resolveCanvasCandidateAction({
    termId: input.termId,
    resolutionMode: "link_only",
    candidate: {
      ...input.candidate,
      id: input.candidate.id ?? input.candidate.title,
      occurrenceCount: input.candidate.occurrenceCount ?? input.candidate.sourceCanvasUids.length,
    },
  });
}

export async function reverseCanvasLinkDecisionAction(
  decisionId: string,
): Promise<ActionResult> {
  try {
    await requireAllowedUser();
    await reverseCanvasLinkDecision(decisionId);
    revalidatePath("/school");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

export type SemesterPreview = {
  summary: { created: number; updated: number; unchanged: number; removed: number };
  conflicts: { occurrenceDateKey: string; classTitle: string; message: string }[];
  occurrenceCount: number;
};

export async function previewSemesterAction(
  input: z.infer<typeof semesterSaveSchema>,
): Promise<ActionResult<SemesterPreview>> {
  try {
    await requireAllowedUser();
    const parsed = semesterSaveSchema.parse(input);
    const term = await getAcademicTermById(parsed.termId);
    if (!term) return { success: false, error: "Term not found" };
    if (term.status === "archived") {
      return { success: false, error: "Cannot reconcile an archived term" };
    }

    const [courses, meetings, exceptions] = await Promise.all([
      listCoursesForTerm(parsed.termId),
      listMeetingsForTerm(parsed.termId),
      listExceptionsForTerm(parsed.termId),
    ]);

    const meetingIds = meetings.map((meeting) => meeting.id);
    const courseById = new Map(courses.map((course) => [course.id, course]));
    const desired = expandAllMeetings({
      meetings: meetings.map((meeting) => {
        const course = courseById.get(meeting.course_id);
        return {
          meeting,
          courseTitle: course?.name ?? "Class",
          courseCode: course?.code ?? "",
        };
      }),
      exceptions,
      termClassesStart: term.classes_start,
      termClassesEnd: term.classes_end,
    });

    const existing = await listAllAcademicClassEventsForTerm(
      term.classes_start,
      term.classes_end,
      meetingIds,
    );
    const { items } = reconcileSemesterOccurrences({
      desiredOccurrences: desired,
      existingEvents: existing,
      removeOmitted: true,
    });

    const allEvents = await listEventsInRange(
      `${term.classes_start}T00:00:00.000Z`,
      `${term.classes_end}T23:59:59.999Z`,
    );
    const conflicts = detectSemesterConflicts(desired, allEvents);

    const summary = {
      created: items.filter((i) => i.action === "created").length,
      updated: items.filter((i) => i.action === "updated").length,
      unchanged: items.filter((i) => i.action === "unchanged").length,
      removed: items.filter((i) => i.action === "removed").length,
    };

    return {
      success: true,
      data: { summary, conflicts, occurrenceCount: desired.length },
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function saveSemesterAction(
  input: z.infer<typeof semesterSaveSchema>,
): Promise<ActionResult<SemesterPreview>> {
  try {
    await requireAllowedUser();
    const parsed = semesterSaveSchema.parse(input);
    const preview = await previewSemesterAction(parsed);
    if (!preview.success || !preview.data) {
      return preview as ActionResult<SemesterPreview>;
    }

    const term = await getAcademicTermById(parsed.termId);
    if (!term) return { success: false, error: "Term not found" };
    if (term.status === "archived") {
      return { success: false, error: "Cannot reconcile an archived term" };
    }

    const [courses, meetings, exceptions] = await Promise.all([
      listCoursesForTerm(parsed.termId),
      listMeetingsForTerm(parsed.termId),
      listExceptionsForTerm(parsed.termId),
    ]);
    const meetingIds = meetings.map((meeting) => meeting.id);
    const courseById = new Map(courses.map((course) => [course.id, course]));
    const desired = expandAllMeetings({
      meetings: meetings.map((meeting) => {
        const course = courseById.get(meeting.course_id);
        return {
          meeting,
          courseTitle: course?.name ?? "Class",
          courseCode: course?.code ?? "",
        };
      }),
      exceptions,
      termClassesStart: term.classes_start,
      termClassesEnd: term.classes_end,
    });
    const existing = await listAllAcademicClassEventsForTerm(
      term.classes_start,
      term.classes_end,
      meetingIds,
    );
    const { items } = reconcileSemesterOccurrences({
      desiredOccurrences: desired,
      existingEvents: existing,
      removeOmitted: parsed.removeOmitted,
    });
    await applySemesterReconciliation(items);

    revalidatePath("/school");
    revalidatePath("/today");
    revalidatePath("/week");

    return { success: true, data: preview.data };
  } catch (error) {
    return toActionError(error);
  }
}

export async function reapplyPresetExceptionsAction(
  termId: string,
  presetKey: string,
  termKey: string,
): Promise<ActionResult<{ inserted: number }>> {
  try {
    await requireAllowedUser();
    const built = buildTermFromPreset({
      presetKey,
      termKey,
      importedAt: new Date().toISOString(),
    });
    if (!built) return { success: false, error: "Preset not found" };

    const existing = await listExceptionsForTerm(termId);
    const toInsert = mergePresetExceptions({
      existing,
      fromPreset: built.exceptions,
    });
    const inserted = await insertPresetExceptions(termId, toInsert);
    revalidatePath("/school");
    return { success: true, data: { inserted } };
  } catch (error) {
    return toActionError(error);
  }
}
