"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";

type Props = {
  email: string;
  versionLabel: string;
};

export function AccountMenu({ email, versionLabel }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const initial = (email.trim()[0] ?? "U").toUpperCase();

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border bg-surface text-sm font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="sr-only">Account menu</span>
        <span aria-hidden="true">{initial}</span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Account"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
        >
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-sm font-medium text-foreground">{email}</p>
            <p className="text-xs text-muted">Version {versionLabel}</p>
          </div>
          <Link
            role="menuitem"
            href="/settings/general"
            className="block min-h-11 px-3 py-2.5 text-sm text-foreground hover:bg-surface-elevated"
            onClick={() => setOpen(false)}
          >
            Profile
          </Link>
          <Link
            role="menuitem"
            href="/status"
            className="block min-h-11 px-3 py-2.5 text-sm text-foreground hover:bg-surface-elevated"
            onClick={() => setOpen(false)}
          >
            System status
          </Link>
          <button
            type="button"
            role="menuitem"
            className="block w-full min-h-11 px-3 py-2.5 text-left text-sm text-danger hover:bg-surface-elevated"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
