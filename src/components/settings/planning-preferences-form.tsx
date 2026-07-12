"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updatePlanningPreferencesAction } from "@/lib/actions/settings";
import type { PlanningPreferencesFormInput } from "@/lib/validation/preferences";
import type { PlanningPreferencesRow } from "@/types/domain";
import {
  FormField,
  inputClassName,
  PrimaryButton,
} from "@/components/forms/ui";
import { splitTimeForForm } from "@/lib/dates/timezone";

export function PlanningPreferencesForm({
  preferences,
  weekStartsOn,
}: {
  preferences: PlanningPreferencesRow;
  weekStartsOn: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    const input: PlanningPreferencesFormInput = {
      minimumBreakMinutes: Number(formData.get("minimumBreakMinutes")),
      travelBufferMinutes: Number(formData.get("travelBufferMinutes")),
      planningBufferPercent: Number(formData.get("planningBufferPercent")),
      preferredFocusBlockMinutes: Number(formData.get("preferredFocusBlockMinutes")),
      maximumFocusBlockMinutes: Number(formData.get("maximumFocusBlockMinutes")),
      dailyNotificationTime: preferences.daily_notification_time ?? "",
      weeklyNotificationDay: preferences.weekly_notification_day,
      weeklyNotificationTime: preferences.weekly_notification_time ?? "",
      autoCreateFocusBlocks: formData.get("autoCreateFocusBlocks") === "on",
      avoidDifficultWorkAfter: String(formData.get("avoidDifficultWorkAfter") ?? ""),
      weekStartsOn,
    };

    startTransition(async () => {
      setError(null);
      const result = await updatePlanningPreferencesAction(input);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Minimum break (min)" htmlFor="minimumBreakMinutes">
          <input id="minimumBreakMinutes" name="minimumBreakMinutes" type="number" min={0} max={240} defaultValue={preferences.minimum_break_minutes} className={inputClassName} />
        </FormField>
        <FormField label="Travel buffer (min)" htmlFor="travelBufferMinutes">
          <input id="travelBufferMinutes" name="travelBufferMinutes" type="number" min={0} max={240} defaultValue={preferences.travel_buffer_minutes} className={inputClassName} />
        </FormField>
      </div>

      <FormField label="Planning buffer (%)" htmlFor="planningBufferPercent">
        <input id="planningBufferPercent" name="planningBufferPercent" type="number" min={0} max={80} defaultValue={preferences.planning_buffer_percent} className={inputClassName} />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Preferred focus block (min)" htmlFor="preferredFocusBlockMinutes">
          <input id="preferredFocusBlockMinutes" name="preferredFocusBlockMinutes" type="number" min={15} max={480} defaultValue={preferences.preferred_focus_block_minutes} className={inputClassName} />
        </FormField>
        <FormField label="Maximum focus block (min)" htmlFor="maximumFocusBlockMinutes">
          <input id="maximumFocusBlockMinutes" name="maximumFocusBlockMinutes" type="number" min={15} max={720} defaultValue={preferences.maximum_focus_block_minutes} className={inputClassName} />
        </FormField>
      </div>

      <FormField label="Avoid difficult work after" htmlFor="avoidDifficultWorkAfter">
        <input id="avoidDifficultWorkAfter" name="avoidDifficultWorkAfter" type="time" defaultValue={splitTimeForForm(preferences.avoid_difficult_work_after)} className={inputClassName} />
      </FormField>

      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" name="autoCreateFocusBlocks" defaultChecked={preferences.auto_create_focus_blocks} className="h-4 w-4 rounded border-border" />
        Auto-create focus blocks (future scheduling phase)
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}

      <PrimaryButton type="submit" loading={isPending}>
        Save preferences
      </PrimaryButton>
    </form>
  );
}
