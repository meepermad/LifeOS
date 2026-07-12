"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createTaskAction,
  updateTaskAction,
} from "@/lib/actions/tasks";
import { TASK_STATUSES } from "@/lib/constants";
import type { TaskFormInput } from "@/lib/validation/tasks";
import type { TaskRow } from "@/types/domain";
import {
  FormField,
  inputClassName,
  PrimaryButton,
  SecondaryButton,
  selectClassName,
  textareaClassName,
} from "@/components/forms/ui";
import { splitDateTimeForForm } from "@/lib/dates/timezone";

type TaskFormProps = {
  task?: TaskRow;
  cancelHref: string;
};

export function TaskForm({ task, cancelHref }: TaskFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const due = task?.due_at ? splitDateTimeForForm(task.due_at) : null;
  const earliest = task?.earliest_start_at
    ? splitDateTimeForForm(task.earliest_start_at)
    : null;

  function handleSubmit(formData: FormData) {
    const input: TaskFormInput = {
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      dueDate: String(formData.get("dueDate") ?? ""),
      dueTime: String(formData.get("dueTime") ?? ""),
      earliestStartDate: String(formData.get("earliestStartDate") ?? ""),
      earliestStartTime: String(formData.get("earliestStartTime") ?? ""),
      estimatedMinutes: formData.get("estimatedMinutes")
        ? Number(formData.get("estimatedMinutes"))
        : null,
      remainingMinutes: formData.get("remainingMinutes")
        ? Number(formData.get("remainingMinutes"))
        : null,
      priority: Number(formData.get("priority") ?? 3),
      difficulty: Number(formData.get("difficulty") ?? 3),
      status: String(formData.get("status") ?? "open") as TaskFormInput["status"],
      splittable: formData.get("splittable") === "on",
      minimumBlockMinutes: Number(formData.get("minimumBlockMinutes") ?? 25),
    };

    startTransition(async () => {
      setFormError(null);
      setFieldErrors({});

      const result = task
        ? await updateTaskAction(task.id, input)
        : await createTaskAction(input);

      if (!result.success) {
        setFormError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      router.push(cancelHref);
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <FormField label="Title" htmlFor="title" error={fieldErrors.title}>
        <input
          id="title"
          name="title"
          required
          defaultValue={task?.title ?? ""}
          className={inputClassName}
        />
      </FormField>

      <FormField label="Description" htmlFor="description">
        <textarea
          id="description"
          name="description"
          defaultValue={task?.description ?? ""}
          className={textareaClassName}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Due date" htmlFor="dueDate" error={fieldErrors.dueDate}>
          <input
            id="dueDate"
            name="dueDate"
            type="date"
            defaultValue={due?.date ?? ""}
            className={inputClassName}
          />
        </FormField>
        <FormField label="Due time" htmlFor="dueTime">
          <input
            id="dueTime"
            name="dueTime"
            type="time"
            defaultValue={due?.time ?? ""}
            className={inputClassName}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Earliest start date" htmlFor="earliestStartDate" error={fieldErrors.earliestStartDate}>
          <input
            id="earliestStartDate"
            name="earliestStartDate"
            type="date"
            defaultValue={earliest?.date ?? ""}
            className={inputClassName}
          />
        </FormField>
        <FormField label="Earliest start time" htmlFor="earliestStartTime">
          <input
            id="earliestStartTime"
            name="earliestStartTime"
            type="time"
            defaultValue={earliest?.time ?? ""}
            className={inputClassName}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Estimated minutes" htmlFor="estimatedMinutes" error={fieldErrors.estimatedMinutes}>
          <input
            id="estimatedMinutes"
            name="estimatedMinutes"
            type="number"
            min={0}
            defaultValue={task?.estimated_minutes ?? ""}
            className={inputClassName}
          />
        </FormField>
        <FormField label="Remaining minutes" htmlFor="remainingMinutes" error={fieldErrors.remainingMinutes}>
          <input
            id="remainingMinutes"
            name="remainingMinutes"
            type="number"
            min={0}
            defaultValue={task?.remaining_minutes ?? ""}
            className={inputClassName}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Priority (1–5)" htmlFor="priority" error={fieldErrors.priority}>
          <input
            id="priority"
            name="priority"
            type="number"
            min={1}
            max={5}
            defaultValue={task?.priority ?? 3}
            className={inputClassName}
          />
        </FormField>
        <FormField label="Difficulty (1–5)" htmlFor="difficulty" error={fieldErrors.difficulty}>
          <input
            id="difficulty"
            name="difficulty"
            type="number"
            min={1}
            max={5}
            defaultValue={task?.difficulty ?? 3}
            className={inputClassName}
          />
        </FormField>
      </div>

      <FormField label="Minimum block minutes" htmlFor="minimumBlockMinutes">
        <input
          id="minimumBlockMinutes"
          name="minimumBlockMinutes"
          type="number"
          min={5}
          max={480}
          defaultValue={task?.minimum_block_minutes ?? 25}
          className={inputClassName}
        />
      </FormField>

      <FormField label="Status" htmlFor="status">
        <select
          id="status"
          name="status"
          defaultValue={task?.status ?? "open"}
          className={selectClassName}
        >
          {TASK_STATUSES.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </FormField>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          name="splittable"
          defaultChecked={task?.splittable ?? true}
          className="h-4 w-4 rounded border-border"
        />
        Splittable into multiple focus blocks
      </label>

      {formError && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {formError}
        </p>
      )}

      <PrimaryButton type="submit" loading={isPending}>
        {task ? "Save task" : "Create task"}
      </PrimaryButton>

      <SecondaryButton type="button" onClick={() => router.push(cancelHref)}>
        Cancel
      </SecondaryButton>
    </form>
  );
}
