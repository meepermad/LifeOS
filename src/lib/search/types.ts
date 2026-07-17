export const SEARCH_MAX_QUERY_LENGTH = 80;
export const SEARCH_RESULTS_PER_CATEGORY = 5;

export type SearchResultCategory =
  | "command"
  | "task"
  | "event"
  | "work_shift"
  | "course"
  | "term"
  | "work_profile"
  | "recurring_template"
  | "notification"
  | "page";

export type SearchResult = {
  id: string;
  category: SearchResultCategory;
  title: string;
  subtitle?: string;
  href: string;
};

export {
  COMMAND_REGISTRY as NAVIGATION_COMMANDS,
  APP_PAGES,
  matchRegisteredCommands as matchLocalCommands,
  findCommandById,
} from "@/lib/search/command-registry";

export function normalizeSearchQuery(raw: string): string {
  return raw.trim().slice(0, SEARCH_MAX_QUERY_LENGTH);
}

export function categoryLabel(category: SearchResultCategory): string {
  switch (category) {
    case "command":
      return "Commands";
    case "task":
      return "Tasks";
    case "event":
      return "Events";
    case "work_shift":
      return "Work shifts";
    case "course":
      return "Courses";
    case "term":
      return "Academic terms";
    case "work_profile":
      return "Work profiles";
    case "recurring_template":
      return "Recurring tasks";
    case "notification":
      return "Notifications";
    case "page":
      return "Pages";
    default:
      return "Results";
  }
}
