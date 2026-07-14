"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  previewWorkScheduleAction,
  saveWorkScheduleAction,
  copyPreviousWeekDraftAction,
  assignUnassignedShiftsAction,
  archiveWorkProfileAction,
  saveWorkProfileAction,
  type WorkSchedulePreview,
} from "@/lib/actions/work-schedule";
import {
  createEmptySlot,
  type DayShiftDraft,
  type ShiftSlotDraft,
} from "@/lib/work/shift-draft";
import type { WorkProfileRow, WorkShiftTemplateRow } from "@/types/domain";
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
import {
  useClearDraftOnSuccess,
  useDraftRecovery,
} from "@/lib/pwa/draft-recovery";
import { useOperationalState } from "@/components/pwa/operational-provider";
import { PendingLabels } from "@/lib/ui/feedback-copy";

type Props = {
  userId: string;
  weekStartKey: string;
  weekOffset: number;
  dayKeys: string[];
  initialDays: DayShiftDraft[];
  templates: WorkShiftTemplateRow[];
  existingShifts: EventWithCalendar[];
  workProfiles: WorkProfileRow[];
  unassignedShiftIds: string[];
};

function formatDayLabel(dateKey: string): string {
  return formatAppDate(`${dateKey}T12:00:00Z`, "EEEE");
}

export function WorkScheduleEditor({
  userId,
  weekStartKey,
  weekOffset,
  dayKeys,
  initialDays,
  templates,
  existingShifts,
  workProfiles,
  unassignedShiftIds,
}: Props) {
  const router = useRouter();
  const [days, setDays] = useState<DayShiftDraft[]>(initialDays);
  const [preview, setPreview] = useState<WorkSchedulePreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOmittedPrompt, setShowOmittedPrompt] = useState(false);
  const [confirmLongShifts, setConfirmLongShifts] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [unassignedProfileId, setUnassignedProfileId] = useState("");
  const [profileName, setProfileName] = useState("");
  const { online, setCriticalMutation } = useOperationalState();
  const formId = `work-week:${weekStartKey}`;
  const clearDraftStorage = useClearDraftOnSuccess(userId, formId);
  const onRestore = useCallback((draft: DayShiftDraft[]) => {
    setDays(draft);
  }, []);
  useDraftRecovery({
    userId,
    formId,
    value: days,
    onRestore,
  });

  const hoursSummary = calculateWorkHours(
    existingShifts,
    Object.fromEntries(workProfiles.map((profile) => [profile.id, profile.display_name])),
  );

  function updateSlot(dayIndex: number, slotIndex: number, patch: Partial<ShiftSlotDraft>) {
    setDays((current) =>
      current.map((day, i) =>
        i === dayIndex
          ? {
              ...day,
              shifts: day.shifts.map((shift, j) =>
                j === slotIndex ? { ...shift, ...patch } : shift,
              ),
            }
          : day,
      ),
    );
    setPreview(null);
    setMessage(null);
    setError(null);
  }

  function clearDraft() {
    setDays(
      dayKeys.map((dateKey) => ({ dateKey, shifts: [] })),
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

  function addSlot(dayIndex: number, slot?: ShiftSlotDraft) {
    setDays((current) =>
      current.map((day, index) =>
        index === dayIndex
          ? {
              ...day,
              shifts: [...day.shifts, slot ?? createEmptySlot(day.dateKey)],
            }
          : day,
      ),
    );
    setPreview(null);
  }

  function removeSlot(dayIndex: number, slotIndex: number) {
    setDays((current) =>
      current.map((day, index) =>
        index === dayIndex
          ? { ...day, shifts: day.shifts.filter((_, i) => i !== slotIndex) }
          : day,
      ),
    );
    setPreview(null);
  }

  function applyTemplate(template: WorkShiftTemplateRow, selectedDays: number[]) {
    selectedDays.forEach((index) =>
      addSlot(index, {
        ...createEmptySlot(dayKeys[index]!),
        startTime: template.start_time,
        endTime: template.end_time,
        unpaidBreakMinutes: template.unpaid_break_minutes,
        location: template.location ?? "",
        note: template.label ?? "",
        workProfileId: template.work_profile_id,
      }),
    );
  }

  function handleReview() {
    if (!online) {
      setError("You are offline. Server-backed changes are unavailable.");
      return;
    }
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
    if (!online) {
      setError("You are offline. Server-backed changes are unavailable.");
      return;
    }
    startTransition(async () => {
      setCriticalMutation(true);
      try {
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
        clearDraftStorage();
        router.refresh();
      } finally {
        setCriticalMutation(false);
      }
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

  function assignUnassigned() {
    if (!unassignedProfileId) return;
    startTransition(async () => {
      const result = await assignUnassignedShiftsAction({
        ids: unassignedShiftIds,
        profileId: unassignedProfileId,
      });
      if (!result.success) setError(result.error);
      else router.refresh();
    });
  }

  function createProfile() {
    if (!profileName.trim()) return;
    startTransition(async () => {
      const result = await saveWorkProfileAction({
        employerName: profileName,
        displayName: profileName,
      });
      if (!result.success) setError(result.error);
      else {
        setProfileName("");
        router.refresh();
      }
    });
  }

  function archiveProfile(profileId: string) {
    startTransition(async () => {
      const result = await archiveWorkProfileAction(profileId);
      if (!result.success) setError(result.error);
      else router.refresh();
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

      {Object.keys(hoursSummary.byProfile).length > 0 ? (
        <ul className="grid gap-2 text-sm text-muted sm:grid-cols-2">
          {Object.values(hoursSummary.byProfile).map((profile) => (
            <li
              key={profile.displayName}
              className="rounded-lg border border-border px-3 py-2"
            >
              <span className="font-medium text-foreground">{profile.displayName}</span>
              <span className="mt-1 block">
                {(profile.workedMinutes / 60).toFixed(1)}h worked · {profile.shiftCount}{" "}
                shifts · avg {(profile.averageShiftMinutes / 60).toFixed(1)}h
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <SecondaryButton onClick={handleCopyPreviousWeek} disabled={isPending}>
          Copy previous week
        </SecondaryButton>
        <SecondaryButton onClick={clearDraft} disabled={isPending}>
          Clear draft
        </SecondaryButton>
      </div>

      {unassignedShiftIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning p-3 text-sm">
          <span>{unassignedShiftIds.length} work shift{unassignedShiftIds.length === 1 ? "" : "s"} still need a work profile.</span>
          <select className={inputClassName} value={unassignedProfileId} onChange={(e) => setUnassignedProfileId(e.target.value)}>
            <option value="">Assign profile</option>
            {workProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.display_name}</option>)}
          </select>
          <SecondaryButton onClick={assignUnassigned} disabled={!unassignedProfileId || isPending}>Assign {unassignedShiftIds.length} shifts</SecondaryButton>
        </div>
      )}

      <SectionCard title="Work profiles" description="Profiles label shifts and preserve employer defaults.">
        <div className="flex flex-wrap gap-2">
          {workProfiles.map((profile) => (
            <span key={profile.id} className="flex items-center gap-1 rounded-full border border-border px-2 py-1 text-sm">
              {profile.display_name}
              <button type="button" className="text-muted" onClick={() => archiveProfile(profile.id)} aria-label={`Archive ${profile.display_name}`}>×</button>
            </span>
          ))}
          <input className={inputClassName} placeholder="New profile name" value={profileName} onChange={(e) => setProfileName(e.target.value)} />
          <SecondaryButton onClick={createProfile} disabled={!profileName.trim() || isPending}>Add profile</SecondaryButton>
        </div>
      </SectionCard>

      <ShiftTemplatesPanel templates={templates} dayKeys={dayKeys} onApply={applyTemplate} />

      <SectionCard title="Weekly schedule" description="Add as many shifts as needed. Times use your profile timezone.">
        <div className="space-y-4">
          {days.map((day, index) => (
            <div
              key={day.dateKey}
              className="rounded-lg border border-border p-3 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium">{formatDayLabel(day.dateKey)}</h3>
                <SecondaryButton onClick={() => addSlot(index)}>Add shift</SecondaryButton>
              </div>
              {day.shifts.length === 0 ? (
                <p className="text-sm text-muted">No shifts.</p>
              ) : day.shifts.map((shift, slotIndex) => (
                <div key={shift.clientId} className="rounded border border-border p-3 space-y-3">
                  <div className="flex justify-end gap-2">
                    <SecondaryButton onClick={() => addSlot(index, { ...shift, clientId: crypto.randomUUID(), eventId: undefined, externalEventId: undefined })}>Duplicate</SecondaryButton>
                    <SecondaryButton onClick={() => removeSlot(index, slotIndex)}>Remove</SecondaryButton>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Profile" htmlFor={`profile-${index}-${slotIndex}`}>
                    <select id={`profile-${index}-${slotIndex}`} className={inputClassName} value={shift.workProfileId ?? ""} onChange={(e) => updateSlot(index, slotIndex, { workProfileId: e.target.value || null })}>
                      <option value="">Unassigned work</option>
                      {workProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.display_name}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Start" htmlFor={`start-${index}`}>
                    <input
                      id={`start-${index}`}
                      type="time"
                      className={inputClassName}
                      value={shift.startTime}
                      onChange={(e) => updateSlot(index, slotIndex, { startTime: e.target.value })}
                    />
                  </FormField>
                  <FormField label="End" htmlFor={`end-${index}`}>
                    <input
                      id={`end-${index}`}
                      type="time"
                      className={inputClassName}
                      value={shift.endTime}
                      onChange={(e) => updateSlot(index, slotIndex, { endTime: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Break (minutes)" htmlFor={`break-${index}`}>
                    <input
                      id={`break-${index}`}
                      type="number"
                      min={0}
                      className={inputClassName}
                      value={shift.unpaidBreakMinutes}
                      onChange={(e) =>
                        updateSlot(index, slotIndex, {
                          unpaidBreakMinutes: Number.parseInt(e.target.value, 10) || 0,
                        })
                      }
                    />
                  </FormField>
                  <FormField label="Location" htmlFor={`location-${index}`}>
                    <input
                      id={`location-${index}`}
                      className={inputClassName}
                      value={shift.location}
                      onChange={(e) => updateSlot(index, slotIndex, { location: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Note" htmlFor={`note-${index}`}>
                    <input
                      id={`note-${index}`}
                      className={inputClassName}
                      value={shift.note}
                      onChange={(e) => updateSlot(index, slotIndex, { note: e.target.value })}
                    />
                  </FormField>
                  </div>
                  {shift.startTime && shift.endTime && shift.endTime <= shift.startTime && <p className="text-xs text-muted">Ends the following day.</p>}
                </div>
              ))}
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
        <PrimaryButton
          onClick={handleReview}
          loading={isPending}
          disabled={isPending || !online}
          pendingLabel={PendingLabels.creatingPreview}
        >
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
