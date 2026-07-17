"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { openSearchPalette } from "@/components/search/command-palette-provider";
import { NavIcon, hrefToNavIcon } from "@/components/icons/nav-icon";

const PRIMARY_NAV = [
  { href: "/today", label: "Today" },
  { href: "/inbox", label: "Inbox" },
  { href: "/calendar", label: "Calendar" },
  { href: "/tasks", label: "Tasks" },
  { href: "/chat", label: "Chat" },
] as const;

const MORE_NAV = [
  { href: "/inbox", label: "Inbox" },
  { href: "/review/daily", label: "Daily Review" },
  { href: "/review/weekly", label: "Weekly Review" },
  { href: "/work", label: "Work" },
  { href: "/school", label: "School" },
  { href: "/insights", label: "Insights" },
  { href: "/imports", label: "Imports" },
  { href: "/status", label: "Status" },
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
                  className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] transition-colors sm:px-2 sm:text-xs ${
                    isActive ? "text-accent" : "text-muted hover:text-foreground"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <NavIcon
                    name={hrefToNavIcon(item.href)}
                    className="h-5 w-5"
                  />
                  <span className="font-medium">{item.label}</span>
                </Link>
              </li>
            );
          })}
          <li className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen((open) => !open)}
              className={`flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] transition-colors sm:px-2 sm:text-xs ${
                isMoreActive || moreOpen
                  ? "text-accent"
                  : "text-muted hover:text-foreground"
              }`}
              aria-expanded={moreOpen}
              aria-controls="more-navigation-sheet"
            >
              <NavIcon name="more" className="h-5 w-5" />
              <span className="font-medium">More</span>
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen && (
        <div
          id="more-navigation-sheet"
          className="safe-bottom fixed inset-x-0 bottom-16 z-50 max-h-[70vh] overflow-y-auto rounded-t-2xl border border-border bg-surface p-4 shadow-xl lg:hidden"
          role="dialog"
          aria-label="More navigation"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">More</h2>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center text-muted hover:text-foreground"
              aria-label="Close more menu"
            >
              ✕
            </button>
          </div>
          <ul className="grid gap-2">
            <li>
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  openSearchPalette();
                }}
                className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-border px-3 py-3 text-left text-sm text-foreground hover:bg-surface-elevated"
              >
                <NavIcon name="search" className="h-4 w-4" />
                Search
              </button>
            </li>
            {MORE_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-surface-elevated"
                >
                  <NavIcon
                    name={hrefToNavIcon(item.href)}
                    className="h-4 w-4"
                  />
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
