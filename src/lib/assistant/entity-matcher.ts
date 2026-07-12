import type { TaskRow } from "@/types/domain";

export type TaskMatchResult =
  | { kind: "exact"; task: TaskRow }
  | { kind: "unique"; task: TaskRow }
  | { kind: "multiple"; tasks: TaskRow[] }
  | { kind: "none" };

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isActiveTask(task: TaskRow): boolean {
  return ["open", "in_progress", "deferred"].includes(task.status);
}

export function matchTasks(
  query: string,
  tasks: TaskRow[],
): TaskMatchResult {
  const normalizedQuery = normalizeTitle(query);
  if (!normalizedQuery) {
    return { kind: "none" };
  }

  const activeTasks = tasks.filter(isActiveTask);

  const exactMatches = activeTasks.filter(
    (task) => normalizeTitle(task.title) === normalizedQuery,
  );
  if (exactMatches.length === 1) {
    return { kind: "exact", task: exactMatches[0] };
  }
  if (exactMatches.length > 1) {
    return { kind: "multiple", tasks: exactMatches };
  }

  const containsMatches = activeTasks.filter((task) => {
    const normalizedTitle = normalizeTitle(task.title);
    return (
      normalizedTitle.includes(normalizedQuery) ||
      normalizedQuery.includes(normalizedTitle)
    );
  });

  if (containsMatches.length === 0) {
    return { kind: "none" };
  }

  if (containsMatches.length === 1) {
    return { kind: "unique", task: containsMatches[0] };
  }

  const strongMatches = containsMatches.filter((task) => {
    const normalizedTitle = normalizeTitle(task.title);
    const queryWords = normalizedQuery.split(" ").filter(Boolean);
    const titleWords = normalizedTitle.split(" ").filter(Boolean);
    const overlap = queryWords.filter((word) => titleWords.includes(word));
    return overlap.length >= Math.min(queryWords.length, 2);
  });

  if (strongMatches.length === 1) {
    return { kind: "unique", task: strongMatches[0] };
  }

  return {
    kind: "multiple",
    tasks: strongMatches.length > 1 ? strongMatches : containsMatches,
  };
}

export function formatTaskChoices(tasks: TaskRow[]): string {
  return tasks
    .map((task, index) => `${index + 1}. ${task.title}`)
    .join("\n");
}
