import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Download,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  LineChart,
  MessageCircle,
  MoreHorizontal,
  Plug,
  Search,
  Settings,
  Activity,
  Bell,
  Keyboard,
  SlidersHorizontal,
  Sparkles,
  UserRound,
} from "lucide-react";

export const NAV_ICONS = {
  today: LayoutDashboard,
  inbox: Inbox,
  calendar: CalendarDays,
  tasks: CheckSquare,
  chat: MessageCircle,
  reviewDaily: ClipboardList,
  reviewWeekly: ClipboardList,
  work: Briefcase,
  school: GraduationCap,
  insights: LineChart,
  imports: Download,
  status: Activity,
  settings: Settings,
  search: Search,
  more: MoreHorizontal,
  general: UserRound,
  planning: SlidersHorizontal,
  notifications: Bell,
  integrations: Plug,
  shortcuts: Keyboard,
  data: Download,
  advanced: Sparkles,
} as const satisfies Record<string, LucideIcon>;

export type NavIconKey = keyof typeof NAV_ICONS;

export function NavIcon({
  name,
  className = "h-5 w-5",
  "aria-hidden": ariaHidden = true,
}: {
  name: NavIconKey;
  className?: string;
  "aria-hidden"?: boolean;
}) {
  const Icon = NAV_ICONS[name];
  return <Icon className={className} aria-hidden={ariaHidden} />;
}

export function hrefToNavIcon(href: string): NavIconKey {
  if (href.startsWith("/today")) return "today";
  if (href.startsWith("/inbox")) return "inbox";
  if (href.startsWith("/calendar")) return "calendar";
  if (href.startsWith("/tasks")) return "tasks";
  if (href.startsWith("/chat")) return "chat";
  if (href.startsWith("/review/daily")) return "reviewDaily";
  if (href.startsWith("/review/weekly")) return "reviewWeekly";
  if (href.startsWith("/work")) return "work";
  if (href.startsWith("/school")) return "school";
  if (href.startsWith("/insights")) return "insights";
  if (href.startsWith("/imports")) return "imports";
  if (href.startsWith("/status")) return "status";
  if (href.startsWith("/settings")) return "settings";
  return "more";
}
