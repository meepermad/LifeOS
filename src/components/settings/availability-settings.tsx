"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createAvailabilityRuleAction,
  deleteAvailabilityRuleAction,
  toggleAvailabilityRuleAction,
} from "@/lib/actions/settings";
import { DAY_NAMES } from "@/lib/constants";
import { splitTimeForForm } from "@/lib/dates/timezone";
import type { AvailabilityRuleRow } from "@/types/domain";
import {
  FormField,
  inputClassName,
  PrimaryButton,
  SecondaryButton,
} from "@/components/forms/ui";

export function AvailabilitySettings({
  rules,
}: {
  rules: AvailabilityRuleRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grouped = new Map<number, AvailabilityRuleRow[]>();
  for (const rule of rules) {
    const list = grouped.get(rule.day_of_week) ?? [];
    list.push(rule);
    grouped.set(rule.day_of_week, list);
  }

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      setError(null);
      const result = await createAvailabilityRuleAction({
        dayOfWeek: Number(formData.get("dayOfWeek")),
        availableStart: String(formData.get("availableStart")),
        availableEnd: String(formData.get("availableEnd")),
        isEnabled: true,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setShowForm(false);
      router.refresh();
    });
  }

  function toggleRule(ruleId: string, enabled: boolean) {
    startTransition(async () => {
      await toggleAvailabilityRuleAction(ruleId, enabled);
      router.refresh();
    });
  }

  function removeRule(ruleId: string) {
    if (!confirm("Delete this availability window?")) return;
    startTransition(async () => {
      await deleteAvailabilityRuleAction(ruleId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {DAY_NAMES.map((dayName, dayIndex) => {
        const dayRules = grouped.get(dayIndex) ?? [];
        return (
          <div key={dayName} className="rounded-lg border border-border/70 p-3">
            <h3 className="text-sm font-medium text-foreground">{dayName}</h3>
            {dayRules.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No windows configured</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {dayRules.map((rule) => (
                  <li
                    key={rule.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className={rule.is_enabled ? "text-foreground" : "text-muted line-through"}>
                      {splitTimeForForm(rule.available_start)} – {splitTimeForForm(rule.available_end)}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => toggleRule(rule.id, !rule.is_enabled)}
                        className="text-xs text-accent"
                      >
                        {rule.is_enabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => removeRule(rule.id)}
                        className="text-xs text-danger"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      {showForm ? (
        <form action={handleCreate} className="space-y-3 rounded-lg border border-border p-3">
          <FormField label="Day" htmlFor="dayOfWeek">
            <select id="dayOfWeek" name="dayOfWeek" className={inputClassName} defaultValue={1}>
              {DAY_NAMES.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Start" htmlFor="availableStart">
              <input id="availableStart" name="availableStart" type="time" required className={inputClassName} />
            </FormField>
            <FormField label="End" htmlFor="availableEnd">
              <input id="availableEnd" name="availableEnd" type="time" required className={inputClassName} />
            </FormField>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <PrimaryButton type="submit" loading={isPending}>
            Add window
          </PrimaryButton>
          <SecondaryButton type="button" onClick={() => setShowForm(false)}>
            Cancel
          </SecondaryButton>
        </form>
      ) : (
        <SecondaryButton onClick={() => setShowForm(true)}>
          Add availability window
        </SecondaryButton>
      )}
    </div>
  );
}
