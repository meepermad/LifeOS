import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteEventButton } from "@/components/events/delete-event-button";
import { EventForm } from "@/components/events/event-form";
import { listWritableCalendars } from "@/lib/data/calendars";
import { getEventById } from "@/lib/data/events";

type EditEventPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditEventPage({ params }: EditEventPageProps) {
  const { id } = await params;

  try {
    const [event, calendars] = await Promise.all([
      getEventById(id),
      listWritableCalendars(),
    ]);

    if (event.is_read_only) {
      return (
        <div className="space-y-4">
          <Link href="/week" className="text-sm text-accent">← Back to week</Link>
          <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
            This event is read-only and cannot be edited.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <Link href="/week" className="text-sm text-accent hover:text-accent-hover">
            ← Back to week
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit event</h1>
        </div>
        <EventForm calendars={calendars} event={event} cancelHref="/week" />
        <DeleteEventButton
          eventId={event.id}
          eventTitle={event.title}
          redirectHref="/week"
        />
      </div>
    );
  } catch {
    notFound();
  }
}
