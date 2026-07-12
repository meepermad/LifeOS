import Link from "next/link";
import { TaskForm } from "@/components/tasks/task-form";

export default function NewTaskPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/tasks" className="text-sm text-accent hover:text-accent-hover">
          ← Back to tasks
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New task</h1>
      </div>
      <TaskForm cancelHref="/tasks" />
    </div>
  );
}
