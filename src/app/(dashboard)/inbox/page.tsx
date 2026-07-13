import { InboxView } from "@/components/inbox/inbox-view";
import { listInboxTasks } from "@/lib/data/inbox";

export default async function InboxPage() {
  const tasks = await listInboxTasks();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="mt-1 text-sm text-muted">
          Capture quickly, then triage into your workload.
        </p>
      </div>

      <InboxView tasks={tasks} />
    </div>
  );
}
