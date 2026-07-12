import Link from "next/link";
import { notFound } from "next/navigation";
import { TaskForm } from "@/components/tasks/task-form";
import { getTaskById } from "@/lib/data/tasks";

type EditTaskPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditTaskPage({ params }: EditTaskPageProps) {
  const { id } = await params;

  try {
    const task = await getTaskById(id);

    return (
      <div className="space-y-6">
        <div>
          <Link href="/tasks" className="text-sm text-accent hover:text-accent-hover">
            ← Back to tasks
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit task</h1>
        </div>
        <TaskForm task={task} cancelHref="/tasks" />
      </div>
    );
  } catch {
    notFound();
  }
}
