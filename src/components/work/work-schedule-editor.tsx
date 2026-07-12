"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  previewWorkScheduleAction,
  saveWorkScheduleAction,
  copyPreviousWeekDraftAction,
  type WorkSchedulePreview,
} from "@/lib/actions/work-schedule";
import type { ShiftDayDraft } from "@/lib/work/shift-draft";
import type { WorkShiftTemplateRow } from "@/types/domain";
import {
  FormField,
  inputClassName,
  PrimaryButton,
  SecondaryButton,
  SectionCard,
} from "@/components/forms/ui";
import { ShiftPreviewPanel } from "@/components/work/shift-preview-panel";
import { ShiftTemplatesPanel } from "@/components/work/shift-templates-panel";
import { formatAppDate } from "@/lib/dates/timezone";
import { calculateWorkHours } from "@/lib/work/work-hours";
import type { EventWithCalendar } from "@/lib/data/events";

type Props = {
  weekStartKey: string;
  weekOffset: number;
  dayKeys: string[];
  initialDays: ShiftDayDraft[];
  templates: WorkShiftTemplateRow[];
  existingShifts: EventWithCalendar[];
};

function formatDayLabel(dateKey: string): string {
  return formatAppDate(`${dateKey}T12:00:00Z`, "EEEE");
}

export function WorkScheduleEditor({
  weekStartKey,
  weekOffset,
  dayKeys,
  initialDays,
  templates,
  existingShifts,
}: Props) {
  const router = useRouter();
  const [days, setDays] = useState<ShiftDayDraft[]>(initialDays);
  const [preview, setPreview] = useState<WorkSchedulePreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOmittedPrompt, setShowOmittedPrompt] = useState(false);
  const [confirmLongShifts, setConfirmLongShifts] = useState(false);
  const [isPending, startTransition] = useTransition();

  const hoursSummary = calculateWorkHours(existingShifts);

  function updateDay(index: number, patch: Partial<ShiftDayDraft>) {
    setDays((current) =>
      current.map((day, i) => (i === index ? { ...day, ...patch } : day)),
    );
    setPreview(null);
    setMessage(null);
    setError(null);
  }

  function clearDraft() {
    setDays(
      dayKeys.map((dateKey) => ({
        dateKey,
        isOff: true,
        startTime: "",
        endTime: "",
        unpaidBreakMinutes: 0,
        location: "",
        note: "",
      })),
    );
    setPreview(null);
    setMessage(null);
    setError(null);
  }

  function navigateWeek(offset: number) {
    const params = new URLSearchParams();
    if (offset !== 0) params.set("offset", String(offset));
    router.push(`/work${params.toString() ? `?${params}` : ""}`);
  }

  function applyTemplate(template: WorkShiftTemplateRow, selectedDays: number[]) {
    setDays((current) =>
      current.map((day, index) =>
        selectedDays.includes(index)
          ? {
              ...day,
              isOff: false,
              startTime: template.start_time,
              endTime: template.end_time,
              unpaidBreakMinutes: template.unpaid_break_minutes,
              location: template.location ?? "",
              note: template.label ?? "",
            }
          : day,
      ),
    );
    setPreview(null);
  }

  function handleReview() {
    startTransition(async () => {
      const result = await previewWorkScheduleAction({ weekStartKey, days });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setPreview(result.data ?? null);
      setError(null);
      if (result.data?.omitted.length) {
        setShowOmittedPrompt(true);
      }
    });
  }

  function handleSave(removeOmitted: boolean) {
    startTransition(async () => {
      const result = await saveWorkScheduleAction({
        weekStartKey,
        days,
        removeOmitted,
        confirmLongShifts,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      const data = result.data!;
      setMessage(
        `Created ${data.created}, updated ${data.updated}, unchanged ${data.unchanged}, removed ${data.removed}.` +
          (data.conflicts > 0 ? ` ${data.conflicts} conflict(s) noted.` : ""),
      );
      setPreview(null);
      setShowOmittedPrompt(false);
      setError(null);
      router.refresh();
    });
  }

  function handleCopyPreviousWeek() {
    startTransition(async () => {
      const result = await copyPreviousWeekDraftAction(weekStartKey);
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.data?.days) {
        setDays(result.data.days);
        setPreview(null);
        setMessage("Copied previous week's schedule into this draft.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <SecondaryButton onClick={() => navigateWeek(weekOffset - 1)}>
            Previous week
          </SecondaryButton>
          <SecondaryButton onClick={() => navigateWeek(0)}>This week</SecondaryButton>
          <SecondaryButton onClick={() => navigateWeek(weekOffset + 1)}>
            Next week
          </SecondaryButton>
        </div>
        <p className="text-sm text-muted">
          {hoursSummary.shiftCount} shift{hoursSummary.shiftCount === 1 ? "" : "s"} ·{" "}
          {(hoursSummary.workedMinutes / 60).toFixed(1)} hours worked
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <SecondaryButton onClick={handleCopyPreviousWeek} disabled={isPending}>
          Copy previous week
        </SecondaryButton>
        <SecondaryButton onClick={clearDraft} disabled={isPending}>
          Clear draft
        </SecondaryButton>
      </div>

      <ShiftTemplatesPanel templates={templates} dayKeys={dayKeys} onApply={applyTemplate} />

      <SectionCard title="Weekly schedule" description="One shift per day. Times use your profile timezone.">
        <div className="space-y-4">
          {days.map((day, index) => (
            <div
              key={day.dateKey}
              className="rounded-lg border border-border p-3 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium">{formatDayLabel(day.dateKey)}</h3>
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={day.isOff}
                    onChange={(e) =>
                      updateDay(index, {
                        isOff: e.target.checked,
                        startTime: e.target.checked ? "" : day.startTime,
                        endTime: e.target.checked ? "" : day.endTime,
                      })
                    }
                  />
                  Off
                </label>
              </div>

              {!day.isOff && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Start" htmlFor={`start-${index}`}>
                    <input
                      id={`start-${index}`}
                      type="time"
                      className={inputClassName}
                      value={day.startTime}
                      onChange={(e) => updateDay(index, { startTime: e.target.value })}
                    />
                  </FormField>
                  <FormField label="End" htmlFor={`end-${index}`}>
                    <input
                      id={`end-${index}`}
                      type="time"
                      className={inputClassName}
                      value={day.endTime}
                      onChange={(e) => updateDay(index, { endTime: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Break (minutes)" htmlFor={`break-${index}`}>
                    <input
                      id={`break-${index}`}
                      type="number"
                      min={0}
                      className={inputClassName}
                      value={day.unpaidBreakMinutes}
                      onChange={(e) =>
                        updateDay(index, {
                          unpaidBreakMinutes: Number.parseInt(e.target.value, 10) || 0,
                        })
                      }
                    />
                  </FormField>
                  <FormField label="Location" htmlFor={`location-${index}`}>
                    <input
                      id={`location-${index}`}
                      className={inputClassName}
                      value={day.location}
                      onChange={(e) => updateDay(index, { location: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Note" htmlFor={`note-${index}`}>
                    <input
                      id={`note-${index}`}
                      className={inputClassName}
                      value={day.note}
                      onChange={(e) => updateDay(index, { note: e.target.value })}
                    />
                  </FormField>
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {message && <p className="text-sm text-foreground">{message}</p>}

      <div className="flex flex-col gap-2 sm:flex-row">
        <PrimaryButton onClick={handleReview} loading={isPending} disabled={isPending}>
          Review shifts
        </PrimaryButton>
        {preview && !showOmittedPrompt && (
          <PrimaryButton
            onClick={() => handleSave(false)}
            loading={isPending}
            disabled={isPending}
          >
            Save confirmed shifts
          </PrimaryButton>
        )}
      </div>

      {preview?.requiresLongShiftConfirmation && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmLongShifts}
            onChange={(e) => setConfirmLongShifts(e.target.checked)}
          />
          Confirm shifts longer than 12 hours
        </label>
      )}

      {showOmittedPrompt && preview && preview.omitted.length > 0 && (
        <SectionCard
          title="Omitted shifts"
          description={`${preview.omitted.length} existing shift(s) are not in this draft.`}
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <PrimaryButton onClick={() => handleSave(false)} loading={isPending}>
              Keep omitted shifts
            </PrimaryButton>
            <SecondaryButton onClick={() => handleSave(true)} disabled={isPending}>
              Remove omitted shifts
            </SecondaryButton>
          </div>
        </SectionCard>
      )}

      {preview && <ShiftPreviewPanel preview={preview} />}
    </div>
  );
}
