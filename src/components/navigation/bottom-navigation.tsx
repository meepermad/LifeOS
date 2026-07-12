"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/today", label: "Today", icon: "☀" },
  { href: "/week", label: "Week", icon: "▦" },
  { href: "/work", label: "Work", icon: "⌁" },
  { href: "/school", label: "School", icon: "◈" },
  { href: "/tasks", label: "Tasks", icon: "☑" },
  { href: "/chat", label: "Chat", icon: "◉" },
  { href: "/settings", label: "Settings", icon: "⚙" },
] as const;

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/95 backdrop-blur-md"
      aria-label="Main navigation"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1 pb-1 pt-2">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] transition-colors sm:px-2 sm:text-xs ${
                  isActive
                    ? "text-accent"
                    : "text-muted hover:text-foreground"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="text-lg leading-none" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="font-medium">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
