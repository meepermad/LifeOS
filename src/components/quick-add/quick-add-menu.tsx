"use client";

import Link from "next/link";
import { useState } from "react";
import { InboxCapture } from "@/components/inbox/inbox-capture";

const QUICK_ADD_OPTIONS = [
  { href: "/events/new", label: "Event" },
  { href: "/tasks/new", label: "Task" },
  { href: "/work", label: "Work shift" },
  { href: "/tasks", label: "Time entry" },
  { href: "/school", label: "Class exception" },
  { href: "/chat", label: "Chat command" },
] as const;

export function QuickAddMenu() {
  const [open, setOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-background shadow-lg"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        + Quick add
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 min-w-72 rounded-xl border border-border bg-surface p-2 shadow-xl"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setCaptureOpen((value) => !value);
            }}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-surface-elevated"
          >
            Inbox capture
          </button>
          {captureOpen && (
            <div className="border-t border-border px-2 py-3">
              <InboxCapture
                compact
                onCaptured={() => {
                  setCaptureOpen(false);
                  setOpen(false);
                }}
              />
            </div>
          )}
          {QUICK_ADD_OPTIONS.map((option) => (
            <Link
              key={option.href + option.label}
              href={option.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-surface-elevated"
            >
              {option.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
