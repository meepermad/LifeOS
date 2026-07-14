"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/today", label: "Today" },
  { href: "/inbox", label: "Inbox" },
  { href: "/calendar", label: "Calendar" },
  { href: "/tasks", label: "Tasks" },
  { href: "/chat", label: "Chat" },
  { href: "/review/daily", label: "Daily Review" },
  { href: "/review/weekly", label: "Weekly Review" },
  { href: "/work", label: "Work" },
  { href: "/school", label: "School" },
  { href: "/insights", label: "Insights" },
  { href: "/imports", label: "Imports" },
  { href: "/status", label: "Status" },
  { href: "/settings", label: "Settings" },
] as const;

export function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 border-r border-border bg-surface/95 pt-20 lg:block">
      <nav aria-label="Desktop navigation">
        <ul className="space-y-1 px-3">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive
                      ? "bg-accent/15 text-accent"
                      : "text-muted hover:bg-surface-elevated hover:text-foreground"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
