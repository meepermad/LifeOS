"use client";

import { openSearchPalette } from "@/components/search/command-palette-provider";

export function HeaderSearchButton() {
  return (
    <button
      type="button"
      onClick={() => openSearchPalette()}
      className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-foreground"
      aria-label="Open search"
    >
      <span className="lg:hidden">Search</span>
      <span className="hidden lg:inline">Search ⌘K</span>
    </button>
  );
}
