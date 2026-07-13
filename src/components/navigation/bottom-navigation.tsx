"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const PRIMARY_NAV = [
  { href: "/today", label: "Today", icon: "☀" },
  { href: "/inbox", label: "Inbox", icon: "📥" },
  { href: "/calendar", label: "Calendar", icon: "▦" },
  { href: "/tasks", label: "Tasks", icon: "☑" },
  { href: "/chat", label: "Chat", icon: "◉" },
] as const;

const MORE_NAV = [
  { href: "/inbox", label: "Inbox" },
  { href: "/review/daily", label: "Daily Review" },
  { href: "/review/weekly", label: "Weekly Review" },
  { href: "/work", label: "Work" },
  { href: "/school", label: "School" },
  { href: "/insights", label: "Insights" },
  { href: "/imports", label: "Imports" },
  { href: "/settings", label: "Settings" },
] as const;

export function BottomNavigation() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive = MORE_NAV.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return (
    <>
      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/95 backdrop-blur-md lg:hidden"
        aria-label="Main navigation"
      >
        <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1 pb-1 pt-2">
          {PRIMARY_NAV.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href} className="min-w-0 flex-1">
                <Link
                  href={item.href}
                  className={`flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] transition-colors sm:px-2 sm:text-xs ${
                    isActive ? "text-accent" : "text-muted hover:text-foreground"
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
          <li className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen((open) => !open)}
              className={`flex w-full flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] transition-colors sm:px-2 sm:text-xs ${
                isMoreActive || moreOpen
                  ? "text-accent"
                  : "text-muted hover:text-foreground"
              }`}
              aria-expanded={moreOpen}
              aria-controls="more-navigation-sheet"
            >
              <span className="text-lg leading-none" aria-hidden="true">
                ⋯
              </span>
              <span className="font-medium">More</span>
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen && (
        <div
          id="more-navigation-sheet"
          className="safe-bottom fixed inset-x-0 bottom-16 z-50 rounded-t-2xl border border-border bg-surface p-4 shadow-xl lg:hidden"
          role="dialog"
          aria-label="More navigation"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">More</h2>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              className="text-muted hover:text-foreground"
              aria-label="Close more menu"
            >
              ✕
            </button>
          </div>
          <ul className="grid gap-2">
            {MORE_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className="block rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-surface-elevated"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
