"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

const CommandPalette = dynamic(
  () =>
    import("@/components/search/command-palette").then(
      (mod) => mod.CommandPalette,
    ),
  { ssr: false },
);

export function CommandPaletteProvider() {
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<"modal" | "sheet">("modal");

  const openPalette = useCallback((nextVariant: "modal" | "sheet" = "modal") => {
    setVariant(nextVariant);
    setOpen(true);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openPalette(
          window.matchMedia("(max-width: 1023px)").matches ? "sheet" : "modal",
        );
      }
    }

    function onOpenSearch() {
      openPalette(
        window.matchMedia("(max-width: 1023px)").matches ? "sheet" : "modal",
      );
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("lifeos:open-search", onOpenSearch);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("lifeos:open-search", onOpenSearch);
    };
  }, [openPalette]);

  return (
    <CommandPalette open={open} onClose={() => setOpen(false)} variant={variant} />
  );
}

export function openSearchPalette() {
  window.dispatchEvent(new Event("lifeos:open-search"));
}
