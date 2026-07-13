import Link from "next/link";
import { RecurringTemplatesList } from "@/components/recurrence/recurring-templates-list";
import { listRecurrenceTemplates } from "@/lib/data/recurrence";

export default async function RecurringTasksPage() {
  const templates = await listRecurrenceTemplates();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Recurring tasks
          </h1>
          <p className="mt-1 text-sm text-muted">
            Templates that generate task instances on a schedule.
          </p>
        </div>
        <Link
          href="/tasks/recurring/new"
          className="shrink-0 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent-hover"
        >
          + Recurring task
        </Link>
      </div>

      <RecurringTemplatesList templates={templates} />
    </div>
  );
}
