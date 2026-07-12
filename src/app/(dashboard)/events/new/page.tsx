import Link from "next/link";
import { EventForm } from "@/components/events/event-form";
import { getManualCalendar, listWritableCalendars } from "@/lib/data/calendars";

export default async function NewEventPage() {
  const [calendars, manualCalendar] = await Promise.all([
    listWritableCalendars(),
    getManualCalendar(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/week" className="text-sm text-accent hover:text-accent-hover">
          ← Back to week
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New event</h1>
      </div>
      <EventForm
        calendars={calendars}
        defaultCalendarId={manualCalendar?.id}
        cancelHref="/week"
      />
    </div>
  );
}
