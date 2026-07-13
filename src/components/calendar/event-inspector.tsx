"use client";

import Link from "next/link";
import {
  formatAppDate,
  formatAppTimeRange,
} from "@/lib/dates/timezone";
import { formatMinutes } from "@/lib/planning/summaries";
import type { CalendarRenderEventExtendedProps } from "@/lib/calendar/types";
import type { EventWithCalendar } from "@/lib/data/events";
import { DangerButton } from "@/components/forms/ui";
import { PlanningBlockFeedbackPanel } from "@/components/calendar/planning-block-feedback-panel";
import { deleteEventAction } from "@/lib/actions/events";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type EventInspectorProps = {
  event: EventWithCalendar | null;
  extendedProps: CalendarRenderEventExtendedProps | null;
  onClose: () => void;
};

export function EventInspector({ event, extendedProps, onClose }: EventInspectorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!event || !extendedProps) return null;

  const durationMinutes = extendedProps.durationMinutes;

  const handleDelete = () => {
    if (!window.confirm("Delete this event?")) return;
    startTransition(async () => {
      const result = await deleteEventAction(event.id);
      if (result.success) {
        onClose();
        router.refresh();
      }
    });
  };

  return (
    <div
      className="fixed inset-x-0 bottom-16 z-40 max-h-[70dvh] overflow-y-auto rounded-t-2xl border border-border bg-surface p-4 shadow-xl lg:static lg:max-h-none lg:w-80 lg:shrink-0 lg:rounded-xl"
      role="dialog"
      aria-label="Event details"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <h2 className="text-base font-medium text-foreground">{event.title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-muted hover:text-foreground"
          aria-label="Close inspector"
        >
          ✕
        </button>
      </div>

      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-muted">Date</dt>
          <dd className="text-foreground">{formatAppDate(event.start_at)}</dd>
        </div>
        <div>
          <dt className="text-muted">Time</dt>
          <dd className="text-foreground">
            {event.all_day
              ? "All day"
              : formatAppTimeRange(event.start_at, event.end_at)}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Duration</dt>
          <dd className="text-foreground">
            {event.all_day ? "All day" : formatMinutes(durationMinutes)}
          </dd>
        </div>
        {event.location && (
          <div>
            <dt className="text-muted">Location</dt>
            <dd className="text-foreground">{event.location}</dd>
          </div>
        )}
        <div>
          <dt className="text-muted">Calendar</dt>
          <dd className="text-foreground">{event.calendar_name}</dd>
        </div>
        <div>
          <dt className="text-muted">Blocking</dt>
          <dd className="text-foreground">{event.blocks_time ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt className="text-muted">Status</dt>
          <dd className="text-foreground">
            {extendedProps.isReadOnly ? "Read-only / managed" : "Editable"}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {extendedProps.editWorkflow === "manual" && (
          <Link
            href={`/events/${event.id}/edit`}
            className="inline-flex rounded-lg bg-accent px-3 py-2 text-xs font-medium text-background"
          >
            Edit
          </Link>
        )}
        {extendedProps.editWorkflow === "work_shift" && (
          <Link
            href="/work"
            className="inline-flex rounded-lg bg-accent px-3 py-2 text-xs font-medium text-background"
          >
            Edit in Work
          </Link>
        )}
        {extendedProps.editWorkflow === "academic" && (
          <Link
            href="/school"
            className="inline-flex rounded-lg bg-accent px-3 py-2 text-xs font-medium text-background"
          >
            School actions
          </Link>
        )}
        {extendedProps.linkedTaskId && (
          <Link
            href={`/tasks/${extendedProps.linkedTaskId}/edit`}
            className="inline-flex rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground"
          >
            View task
          </Link>
        )}
        {extendedProps.editWorkflow === "manual" && (
          <DangerButton onClick={handleDelete} disabled={isPending}>
            {isPending ? "Deleting…" : "Delete"}
          </DangerButton>
        )}
      </div>

      {extendedProps.eventType === "focus_block" && (
        <PlanningBlockFeedbackPanel eventId={event.id} />
      )}
    </div>
  );
}
