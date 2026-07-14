export const SEARCH_MAX_QUERY_LENGTH = 80;
export const SEARCH_RESULTS_PER_CATEGORY = 5;

export type SearchResultCategory =
  | "command"
  | "task"
  | "event"
  | "course"
  | "term"
  | "work_profile"
  | "recurring_template"
  | "page";

export type SearchResult = {
  id: string;
  category: SearchResultCategory;
  title: string;
  subtitle?: string;
  href: string;
};

export const NAVIGATION_COMMANDS: SearchResult[] = [
  { id: "nav-today", category: "command", title: "Go to Today", href: "/today" },
  { id: "nav-calendar", category: "command", title: "Open Calendar", href: "/calendar" },
  { id: "nav-inbox", category: "command", title: "Open Inbox", href: "/inbox" },
  {
    id: "nav-daily-review",
    category: "command",
    title: "Start Daily Review",
    href: "/review/daily",
  },
  {
    id: "nav-weekly-review",
    category: "command",
    title: "Start Weekly Review",
    href: "/review/weekly",
  },
  { id: "nav-add-task", category: "command", title: "Add Task", href: "/tasks/new" },
  { id: "nav-add-event", category: "command", title: "Add Event", href: "/events/new" },
  { id: "nav-add-work", category: "command", title: "Add Work Shift", href: "/work" },
  { id: "nav-timer", category: "command", title: "Start Timer", href: "/tasks" },
  { id: "nav-school", category: "command", title: "Open School Setup", href: "/school" },
  { id: "nav-settings", category: "command", title: "Open Settings", href: "/settings" },
  { id: "nav-status", category: "command", title: "Open System Status", href: "/status" },
  { id: "nav-work", category: "command", title: "Open Work", href: "/work" },
  { id: "nav-insights", category: "command", title: "Open Insights", href: "/insights" },
  { id: "nav-imports", category: "command", title: "Open Imports", href: "/imports" },
  { id: "nav-recurring", category: "command", title: "Open Recurring Tasks", href: "/tasks/recurring" },
];

const APP_PAGES: SearchResult[] = [
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
];

export function normalizeSearchQuery(raw: string): string {
  return raw.trim().slice(0, SEARCH_MAX_QUERY_LENGTH);
}

export function matchLocalCommands(query: string): SearchResult[] {
  const normalized = normalizeSearchQuery(query).toLowerCase();
  if (!normalized) {
    return NAVIGATION_COMMANDS.slice(0, 8);
  }

  const pool = [...NAVIGATION_COMMANDS, ...APP_PAGES];
  return pool
    .filter((item) => item.title.toLowerCase().includes(normalized))
    .slice(0, SEARCH_RESULTS_PER_CATEGORY * 2);
}

export function categoryLabel(category: SearchResultCategory): string {
  switch (category) {
    case "command":
      return "Commands";
    case "task":
      return "Tasks";
    case "event":
      return "Events";
    case "course":
      return "Courses";
    case "term":
      return "Academic terms";
    case "work_profile":
      return "Work profiles";
    case "recurring_template":
      return "Recurring tasks";
    case "page":
      return "Pages";
    default:
      return "Results";
  }
}
