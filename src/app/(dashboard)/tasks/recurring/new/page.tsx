import { RecurrenceTemplateForm } from "@/components/recurrence/recurrence-template-form";

export default function NewRecurringTaskPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          New recurring task
        </h1>
        <p className="mt-1 text-sm text-muted">
          Create a template that generates task instances on a schedule.
        </p>
      </div>
      <RecurrenceTemplateForm cancelHref="/tasks/recurring" />
    </div>
  );
}
