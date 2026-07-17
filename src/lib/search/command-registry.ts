import type { SearchResult } from "@/lib/search/types";
import { SETTINGS_PAGES_FOR_SEARCH } from "@/lib/settings/sections";

export type CommandKind = "navigate" | "action";

export type RegisteredCommand = SearchResult & {
  kind: CommandKind;
  /** Optional action id for palette handlers (timer stop, etc.). */
  actionId?: "stop-timer" | "start-timer" | "review-completed";
  keywords?: string[];
};

/**
 * Central registry for command palette entries.
 * Add new commands here so search + palette stay in sync.
 */
export const COMMAND_REGISTRY: RegisteredCommand[] = [
  {
    id: "nav-today",
    category: "command",
    kind: "navigate",
    title: "Open Today",
    href: "/today",
    keywords: ["dashboard", "home"],
  },
  {
    id: "nav-calendar",
    category: "command",
    kind: "navigate",
    title: "Open Calendar",
    href: "/calendar",
  },
  {
    id: "nav-inbox",
    category: "command",
    kind: "navigate",
    title: "Open Inbox",
    href: "/inbox",
  },
  {
    id: "nav-tasks",
    category: "command",
    kind: "navigate",
    title: "Open Tasks",
    href: "/tasks",
  },
  {
    id: "nav-daily-review",
    category: "command",
    kind: "navigate",
    title: "Start Daily Review",
    href: "/review/daily",
    keywords: ["morning", "evening"],
  },
  {
    id: "nav-weekly-review",
    category: "command",
    kind: "navigate",
    title: "Start Weekly Review",
    href: "/review/weekly",
  },
  {
    id: "nav-add-task",
    category: "command",
    kind: "navigate",
    title: "Create Task",
    href: "/tasks/new",
    keywords: ["add task", "new task"],
  },
  {
    id: "nav-add-event",
    category: "command",
    kind: "navigate",
    title: "Create Event",
    href: "/events/new",
    keywords: ["add event", "new event"],
  },
  {
    id: "nav-add-work",
    category: "command",
    kind: "navigate",
    title: "Add Work Shift",
    href: "/work",
  },
  {
    id: "cmd-start-timer",
    category: "command",
    kind: "action",
    actionId: "start-timer",
    title: "Start Timer",
    href: "/tasks",
    keywords: ["timer", "track"],
  },
  {
    id: "cmd-stop-timer",
    category: "command",
    kind: "action",
    actionId: "stop-timer",
    title: "Stop Timer",
    href: "/today?panel=active-timer",
    keywords: ["timer", "stop"],
  },
  {
    id: "cmd-review-completed",
    category: "command",
    kind: "action",
    actionId: "review-completed",
    title: "Review Completed Task",
    href: "/review/daily?period=evening&step=completed",
    keywords: ["completion", "feedback"],
  },
  {
    id: "nav-school",
    category: "command",
    kind: "navigate",
    title: "Open School Setup",
    href: "/school",
  },
  {
    id: "nav-settings",
    category: "command",
    kind: "navigate",
    title: "Open Settings",
    href: "/settings",
  },
  {
    id: "nav-exports",
    category: "command",
    kind: "navigate",
    title: "Open Exports",
    href: "/settings/data",
    keywords: ["export", "download", "backup"],
  },
  {
    id: "nav-status",
    category: "command",
    kind: "navigate",
    title: "Open System Status",
    href: "/status",
  },
  {
    id: "nav-work",
    category: "command",
    kind: "navigate",
    title: "Open Work",
    href: "/work",
  },
  {
    id: "nav-insights",
    category: "command",
    kind: "navigate",
    title: "Open Insights",
    href: "/insights",
  },
  {
    id: "nav-imports",
    category: "command",
    kind: "navigate",
    title: "Open Imports",
    href: "/imports",
  },
  {
    id: "nav-recurring",
    category: "command",
    kind: "navigate",
    title: "Open Recurring Tasks",
    href: "/tasks/recurring",
  },
  {
    id: "nav-settings-notifications",
    category: "command",
    kind: "navigate",
    title: "Open Notification Settings",
    href: "/settings/notifications",
  },
  {
    id: "nav-settings-shortcuts",
    category: "command",
    kind: "navigate",
    title: "Open Siri & Shortcuts Settings",
    href: "/settings/shortcuts",
  },
];

export const APP_PAGES: SearchResult[] = [
  { id: "page-today", category: "page", title: "Today", href: "/today" },
  { id: "page-calendar", category: "page", title: "Calendar", href: "/calendar" },
  { id: "page-tasks", category: "page", title: "Tasks", href: "/tasks" },
  { id: "page-inbox", category: "page", title: "Inbox", href: "/inbox" },
  { id: "page-chat", category: "page", title: "Chat", href: "/chat" },
  { id: "page-work", category: "page", title: "Work", href: "/work" },
  { id: "page-school", category: "page", title: "School", href: "/school" },
  { id: "page-insights", category: "page", title: "Insights", href: "/insights" },
  { id: "page-settings", category: "page", title: "Settings", href: "/settings" },
  { id: "page-status", category: "page", title: "Status", href: "/status" },
  { id: "page-imports", category: "page", title: "Imports", href: "/imports" },
  ...SETTINGS_PAGES_FOR_SEARCH,
];

function matchesQuery(item: RegisteredCommand, normalized: string): boolean {
  if (item.title.toLowerCase().includes(normalized)) return true;
  return (item.keywords ?? []).some((keyword) =>
    keyword.toLowerCase().includes(normalized),
  );
}

export function matchRegisteredCommands(query: string): SearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return COMMAND_REGISTRY.slice(0, 8).map(toSearchResult);
  }

  const commands = COMMAND_REGISTRY.filter((item) =>
    matchesQuery(item, normalized),
  ).map(toSearchResult);

  const pages = APP_PAGES.filter((item) =>
    item.title.toLowerCase().includes(normalized),
  );

  return [...commands, ...pages].slice(0, 20);
}

function toSearchResult(command: RegisteredCommand): SearchResult {
  return {
    id: command.id,
    category: command.category,
    title: command.title,
    subtitle: command.subtitle,
    href: command.href,
  };
}

export function findCommandById(id: string): RegisteredCommand | undefined {
  return COMMAND_REGISTRY.find((command) => command.id === id);
}
