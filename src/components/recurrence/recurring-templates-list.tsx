"use client";

import { useTransition } from "react";
import {
  archiveRecurrenceTemplateAction,
  endRecurrenceTemplateAction,
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

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
      window.location.reload();
    });
  }

  return (
    <ul className="space-y-3">
      {templates.map((template) => {
        const archived = !!template.archived_at;
        const ended = !!template.ended_at;
        const paused = !!template.paused_at || !template.is_active;
        const statusLabel = archived
          ? "Archived"
          : ended
            ? "Ended"
            : paused
              ? "Paused"
              : "Active";

        return (
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
                <p className="mt-2 text-xs text-muted">
                  Template edits default to updating future incomplete instances
                  only. Completed history stays unchanged.
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    statusLabel === "Active"
                      ? "bg-success/10 text-success"
                      : "bg-muted/10 text-muted"
                  }`}
                >
                  {statusLabel}
                </span>
                {!archived && !ended && (
                  <>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        run(() =>
                          paused
                            ? resumeRecurrenceTemplateAction(template.id)
                            : pauseRecurrenceTemplateAction(template.id),
                        )
                      }
                      className="text-xs text-accent hover:underline"
                    >
                      {paused ? "Resume" : "Pause"}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        run(() => endRecurrenceTemplateAction(template.id))
                      }
                      className="text-xs text-muted hover:underline"
                    >
                      End
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        run(() => archiveRecurrenceTemplateAction(template.id))
                      }
                      className="text-xs text-muted hover:underline"
                    >
                      Archive
                    </button>
                  </>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
