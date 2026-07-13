"use client";

import { useTransition } from "react";
import {
  pauseRecurrenceTemplateAction,
  resumeRecurrenceTemplateAction,
} from "@/lib/actions/recurrence";
import { describeRecurrenceRule } from "@/lib/recurrence/rules";
import type { RecurrenceTemplate } from "@/lib/recurrence/types";

type Props = {
  templates: RecurrenceTemplate[];
};

export function RecurringTemplatesList({ templates }: Props) {
  const [isPending, startTransition] = useTransition();

  if (templates.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">
        No recurring tasks are scheduled. Create one to generate future task
        instances automatically.
      </p>
    );
  }

  function handlePauseResume(template: RecurrenceTemplate) {
    startTransition(async () => {
      if (template.is_active && !template.paused_at) {
        await pauseRecurrenceTemplateAction(template.id);
      } else {
        await resumeRecurrenceTemplateAction(template.id);
      }
      window.location.reload();
    });
  }

  return (
    <ul className="space-y-3">
      {templates.map((template) => (
        <li
          key={template.id}
          className="rounded-xl border border-border bg-surface p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-medium">{template.title}</h2>
              <p className="mt-1 text-xs text-muted">
                {describeRecurrenceRule(template.recurrence_rule)}
              </p>
              <p className="mt-1 text-xs text-muted">
                From {template.first_occurrence_date}
                {template.default_estimate_minutes
                  ? ` · ${template.default_estimate_minutes} min`
                  : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  template.is_active && !template.paused_at
                    ? "bg-success/10 text-success"
                    : "bg-muted/10 text-muted"
                }`}
              >
                {template.is_active && !template.paused_at ? "Active" : "Paused"}
              </span>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handlePauseResume(template)}
                className="text-xs text-accent hover:underline"
              >
                {template.is_active && !template.paused_at ? "Pause" : "Resume"}
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
