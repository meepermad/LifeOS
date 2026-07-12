"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  acceptCanvasCandidateAction,
  activateTermAction,
  applyPresetAction,
  archiveTermAction,
  createTermAction,
  deleteCourseAction,
  deleteExceptionAction,
  deleteMeetingAction,
  getTermDetailsAction,
  previewSemesterAction,
  saveCourseAction,
  saveExceptionAction,
  saveMeetingAction,
  saveSemesterAction,
  updateTermAction,
  type SemesterPreview,
} from "@/lib/actions/school";
import type { AcademicPreset } from "@/lib/academic/presets/schema";
import type { CanvasMeetingCandidate } from "@/lib/academic/canvas-candidates";
import {
  FormField,
  inputClassName,
  PrimaryButton,
  SecondaryButton,
  SectionCard,
  selectClassName,
} from "@/components/forms/ui";
import type {
  AcademicExceptionRow,
  AcademicTermRow,
  ClassMeetingRow,
  CourseRow,
} from "@/types/domain";
import { DAY_NAMES } from "@/lib/constants";

type Props = {
  terms: AcademicTermRow[];
  presets: AcademicPreset[];
  initialTermId: string | null;
};

export function SchoolSetup({ terms, presets, initialTermId }: Props) {
  const router = useRouter();
  const [selectedTermId, setSelectedTermId] = useState<string | null>(
    initialTermId ?? terms[0]?.id ?? null,
  );
  const [term, setTerm] = useState<AcademicTermRow | null>(null);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [meetings, setMeetings] = useState<ClassMeetingRow[]>([]);
  const [exceptions, setExceptions] = useState<AcademicExceptionRow[]>([]);
  const [candidates, setCandidates] = useState<CanvasMeetingCandidate[]>([]);
  const [preview, setPreview] = useState<SemesterPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadTerm = useCallback(async (termId: string) => {
    const result = await getTermDetailsAction(termId);
    if (!result.success || !result.data) {
      setError(result.success ? "Failed to load term" : result.error);
      return;
    }
    setTerm(result.data.term);
    setCourses(result.data.courses);
    setMeetings(result.data.meetings);
    setExceptions(result.data.exceptions);
    setCandidates(result.data.candidates);
    setPreview(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (selectedTermId) {
      void loadTerm(selectedTermId);
    }
  }, [selectedTermId, loadTerm]);

  function handlePresetApply(presetKey: string, termKey: string) {
    startTransition(async () => {
      const result = await applyPresetAction({ presetKey, termKey });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSelectedTermId(result.data?.termId ?? null);
      setMessage("Preset applied.");
      router.refresh();
    });
  }

  function handleSaveTerm() {
    if (!term) return;
    startTransition(async () => {
      const payload = {
        name: term.name,
        institution: term.institution,
        termType: term.term_type as "fall" | "spring" | "summer" | "custom",
        startDate: term.start_date,
        endDate: term.end_date,
        classesStart: term.classes_start,
        classesEnd: term.classes_end,
        finalsStart: term.finals_start,
        finalsEnd: term.finals_end,
        timezone: term.timezone,
        status: term.status as "draft" | "active" | "archived",
      };
      const result = await updateTermAction(term.id, payload);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setMessage("Term saved.");
      router.refresh();
    });
  }

  function handlePreview() {
    if (!selectedTermId) return;
    startTransition(async () => {
      const result = await previewSemesterAction({
        termId: selectedTermId,
        removeOmitted: false,
      });
      if (!result.success || !result.data) {
        setError(result.success ? "Preview failed" : result.error);
        return;
      }
      setPreview(result.data);
      setMessage(null);
      setError(null);
    });
  }

  function handleSaveSemester() {
    if (!selectedTermId) return;
    startTransition(async () => {
      const result = await saveSemesterAction({
        termId: selectedTermId,
        removeOmitted: true,
      });
      if (!result.success || !result.data) {
        setError(result.success ? "Save failed" : result.error);
        return;
      }
      setPreview(result.data);
      setMessage(
        `Saved: ${result.data.summary.created} created, ${result.data.summary.updated} updated, ${result.data.summary.removed} removed.`,
      );
      router.refresh();
      if (selectedTermId) await loadTerm(selectedTermId);
    });
  }

  return (
    <div className="space-y-6">
      <SectionCard title="Academic term" description="Select or create a term.">
        <div className="space-y-3">
          <FormField label="Term" htmlFor="term-select">
            <select
              id="term-select"
              className={selectClassName}
              value={selectedTermId ?? ""}
              onChange={(e) => setSelectedTermId(e.target.value || null)}
            >
              <option value="">Select a term</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.status})
                </option>
              ))}
            </select>
          </FormField>

          {presets.map((preset) => (
            <div key={preset.key} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium">{preset.name}</p>
              <p className="mt-1 text-xs text-muted">
                Source: {preset.sourceUrl} (rev. {preset.revisionDate})
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {preset.terms.map((presetTerm) => (
                  <SecondaryButton
                    key={presetTerm.key}
                    onClick={() => handlePresetApply(preset.key, presetTerm.key)}
                    disabled={isPending}
                  >
                    Add {presetTerm.name}
                  </SecondaryButton>
                ))}
              </div>
            </div>
          ))}

          <SecondaryButton
            onClick={() => {
              startTransition(async () => {
                const result = await createTermAction({
                  name: "New Term",
                  institution: "",
                  termType: "custom",
                  startDate: "2026-08-01",
                  endDate: "2026-12-31",
                  classesStart: "2026-08-24",
                  classesEnd: "2026-12-11",
                  timezone: "America/Chicago",
                  status: "draft",
                });
                if (result.success && result.data) {
                  setSelectedTermId(result.data.termId);
                  router.refresh();
                }
              });
            }}
            disabled={isPending}
          >
            Create blank term
          </SecondaryButton>
        </div>
      </SectionCard>

      {term && (
        <>
          <SectionCard title="Term dates" description="Edit semester boundaries.">
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["name", "Name"],
                  ["institution", "Institution"],
                  ["start_date", "Term start"],
                  ["end_date", "Term end"],
                  ["classes_start", "Classes start"],
                  ["classes_end", "Classes end"],
                  ["finals_start", "Finals start"],
                  ["finals_end", "Finals end"],
                  ["timezone", "Timezone"],
                ] as const
              ).map(([field, label]) => (
                <FormField key={field} label={label} htmlFor={`term-${field}`}>
                  <input
                    id={`term-${field}`}
                    className={inputClassName}
                    value={(term[field] as string) ?? ""}
                    onChange={(e) =>
                      setTerm({ ...term, [field]: e.target.value || null })
                    }
                  />
                </FormField>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <PrimaryButton onClick={handleSaveTerm} loading={isPending}>
                Save term
              </PrimaryButton>
              <SecondaryButton
                onClick={() => {
                  startTransition(async () => {
                    await activateTermAction(term.id);
                    setMessage("Term activated.");
                    router.refresh();
                    await loadTerm(term.id);
                  });
                }}
                disabled={isPending}
              >
                Set active
              </SecondaryButton>
              <SecondaryButton
                onClick={() => {
                  startTransition(async () => {
                    await archiveTermAction(term.id);
                    router.refresh();
                  });
                }}
                disabled={isPending}
              >
                Archive
              </SecondaryButton>
            </div>
          </SectionCard>

          <SectionCard title="Courses" description="Add courses for this term.">
            <div className="space-y-3">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="rounded-lg border border-border p-3 text-sm"
                >
                  <p className="font-medium">
                    {course.code ? `${course.code} — ` : ""}
                    {course.name}
                  </p>
                  <p className="text-xs text-muted">
                    {meetings.filter((m) => m.course_id === course.id).length}{" "}
                    meeting pattern(s)
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-xs text-danger"
                    onClick={() => {
                      startTransition(async () => {
                        await deleteCourseAction(course.id);
                        await loadTerm(term.id);
                      });
                    }}
                  >
                    Delete course
                  </button>
                </div>
              ))}
              <SecondaryButton
                onClick={() => {
                  const name = window.prompt("Course name?");
                  if (!name?.trim()) return;
                  const code = window.prompt("Course code (optional)?") ?? "";
                  startTransition(async () => {
                    await saveCourseAction(term.id, {
                      name: name.trim(),
                      code: code.trim(),
                    });
                    await loadTerm(term.id);
                  });
                }}
                disabled={isPending}
              >
                Add course
              </SecondaryButton>
            </div>
          </SectionCard>

          <SectionCard
            title="Meeting patterns"
            description="Recurring class times per course."
          >
            <div className="space-y-3">
              {courses.map((course) => {
                const courseMeetings = meetings.filter(
                  (m) => m.course_id === course.id,
                );
                return (
                  <div key={course.id} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium">{course.name}</p>
                    {courseMeetings.map((meeting) => (
                      <div key={meeting.id} className="mt-2 text-xs text-muted">
                        {meeting.days_of_week
                          .map((d) => DAY_NAMES[d]?.slice(0, 3))
                          .join(", ")}{" "}
                        {meeting.start_time}–{meeting.end_time}
                        {meeting.is_online ? " (online)" : ""}
                        {meeting.location ? ` @ ${meeting.location}` : ""}
                        <button
                          type="button"
                          className="ml-2 text-danger"
                          onClick={() => {
                            startTransition(async () => {
                              await deleteMeetingAction(meeting.id);
                              await loadTerm(term.id);
                            });
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <div className="mt-2">
                      <SecondaryButton
                        onClick={() => {
                          startTransition(async () => {
                            await saveMeetingAction(course.id, {
                              daysOfWeek: [1, 3, 5],
                              startTime: "09:30",
                              endTime: "10:45",
                              effectiveStartDate: term.classes_start,
                              effectiveEndDate: term.classes_end,
                              location: null,
                              isOnline: false,
                              timezone: term.timezone,
                            });
                            await loadTerm(term.id);
                          });
                        }}
                        disabled={isPending}
                      >
                        Add M/W/F 9:30 pattern
                      </SecondaryButton>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Breaks & exceptions">
            <div className="space-y-2">
              {exceptions.map((exception) => (
                <div
                  key={exception.id}
                  className="rounded-lg border border-border p-3 text-sm"
                >
                  <p className="font-medium">{exception.title}</p>
                  <p className="text-xs text-muted">
                    {exception.exception_type}: {exception.start_date} –{" "}
                    {exception.end_date}
                    {exception.is_user_modified ? " (edited)" : ""}
                  </p>
                  <button
                    type="button"
                    className="mt-1 text-xs text-danger"
                    onClick={() => {
                      startTransition(async () => {
                        await deleteExceptionAction(exception.id);
                        await loadTerm(term.id);
                      });
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}
              <SecondaryButton
                onClick={() => {
                  startTransition(async () => {
                    await saveExceptionAction(term.id, {
                      exceptionType: "break",
                      startDate: term.classes_start,
                      endDate: term.classes_start,
                      title: "Custom break",
                      suppressesClasses: true,
                      blocksAvailability: false,
                      informationalOnly: false,
                      isUserModified: true,
                    });
                    await loadTerm(term.id);
                  });
                }}
                disabled={isPending}
              >
                Add exception
              </SecondaryButton>
            </div>
          </SectionCard>

          {candidates.length > 0 && (
            <SectionCard
              title="Canvas meeting candidates"
              description="Review before converting to class meetings."
            >
              <div className="space-y-3">
                {candidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="rounded-lg border border-border p-3 text-sm"
                  >
                    <p className="font-medium">{candidate.title}</p>
                    <p className="text-xs text-muted">{candidate.reason}</p>
                    <p className="text-xs">
                      Confidence: {candidate.confidence}
                    </p>
                    <PrimaryButton
                      onClick={() => {
                        startTransition(async () => {
                          await acceptCanvasCandidateAction({
                            termId: term.id,
                            candidate,
                          });
                          await loadTerm(term.id);
                        });
                      }}
                      loading={isPending}
                    >
                      Accept as class meeting
                    </PrimaryButton>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          <SectionCard title="Preview & save">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <SecondaryButton onClick={handlePreview} disabled={isPending}>
                  Preview reconciliation
                </SecondaryButton>
                <PrimaryButton onClick={handleSaveSemester} loading={isPending}>
                  Save & reconcile
                </PrimaryButton>
              </div>
              {preview && (
                <div className="rounded-lg border border-border p-3 text-sm">
                  <p>
                    {preview.occurrenceCount} occurrences:{" "}
                    {preview.summary.created} create, {preview.summary.updated}{" "}
                    update, {preview.summary.unchanged} unchanged,{" "}
                    {preview.summary.removed} remove
                  </p>
                  {preview.conflicts.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-warning">
                      {preview.conflicts.slice(0, 5).map((c) => (
                        <li key={`${c.occurrenceDateKey}-${c.classTitle}`}>
                          {c.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </SectionCard>
        </>
      )}

      {message && <p className="text-sm text-accent">{message}</p>}
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
