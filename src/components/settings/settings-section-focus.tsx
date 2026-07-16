"use client";

import { useEffect } from "react";

export function SettingsSectionFocus({ section }: { section?: string }) {
  useEffect(() => {
    if (section !== "notifications") return;
    const el = document.getElementById("settings-notifications");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("ring-2", "ring-accent");
      const timer = window.setTimeout(() => {
        el.classList.remove("ring-2", "ring-accent");
      }, 2500);
      return () => window.clearTimeout(timer);
    }
  }, [section]);

  return null;
}
