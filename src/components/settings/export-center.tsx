"use client";

import { useState } from "react";

const exports = [
  {
    href: "/api/export/calendar.ics",
    label: "Calendar (.ics)",
    description:
      "Visible calendar events, including work shifts. Cancelled events are excluded.",
    estimatedSize: "~50–500 KB",
  },
  {
    href: "/api/export/tasks.csv",
    label: "Tasks (.csv)",
    description:
      "Columns: title, status, due date, estimate, reviewed actual time, course/category, workflow state, completion date.",
    estimatedSize: "~20–200 KB",
  },
  {
    href: "/api/export/time.csv",
    label: "Time (.csv)",
    description:
      "Columns: task, start, end, reviewed duration, source, review state.",
    estimatedSize: "~20–300 KB",
  },
  {
    href: "/api/export/work.csv",
    label: "Work (.csv)",
    description:
      "Columns: employer, role, date, start, end, break, scheduled hours, location.",
    estimatedSize: "~10–100 KB",
  },
  {
    href: "/api/export/backup.json",
    label: "Full backup (.json)",
    description:
      "Versioned archive of your planning data, capped at 5,000 records per collection.",
    estimatedSize: "~0.5–5 MB",
  },
] as const;

type DownloadState = {
  href: string;
  status: "idle" | "generating" | "ready" | "error";
  lastGeneratedAt?: string;
  error?: string;
};

export function ExportCenter() {
  const [states, setStates] = useState<Record<string, DownloadState>>({});

  async function handleDownload(href: string) {
    setStates((prev) => ({
      ...prev,
      [href]: { href, status: "generating" },
    }));

    try {
      const response = await fetch(href, { credentials: "same-origin" });
      if (!response.ok) {
        throw new Error(`Export failed (${response.status})`);
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="?([^"]+)"?/i);
      const filename = match?.[1] ?? href.split("/").pop() ?? "lifeos-export";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);

      setStates((prev) => ({
        ...prev,
        [href]: {
          href,
          status: "ready",
          lastGeneratedAt: new Date().toISOString(),
        },
      }));
    } catch (error) {
      setStates((prev) => ({
        ...prev,
        [href]: {
          href,
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "Could not generate export.",
        },
      }));
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Downloads are generated from your account only and are not retained by
        LifeOS.
      </p>
      <ul className="space-y-2">
        {exports.map((item) => {
          const state = states[item.href];
          return (
            <li
              key={item.href}
              className="flex flex-col gap-2 rounded-lg border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  {item.label}
                </p>
                <p className="mt-1 text-xs text-muted">{item.description}</p>
                <p className="mt-1 text-xs text-muted">
                  Typical size {item.estimatedSize}
                  {state?.lastGeneratedAt
                    ? ` · Last generated ${new Date(state.lastGeneratedAt).toLocaleString()}`
                    : ""}
                </p>
                {state?.status === "generating" ? (
                  <p className="mt-1 text-xs text-accent" role="status">
                    Generating…
                  </p>
                ) : null}
                {state?.status === "ready" ? (
                  <p className="mt-1 text-xs text-success" role="status">
                    Download started
                  </p>
                ) : null}
                {state?.status === "error" ? (
                  <p className="mt-1 text-xs text-danger" role="alert">
                    {state.error}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void handleDownload(item.href)}
                disabled={state?.status === "generating"}
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-border px-3 py-2 text-sm font-medium text-accent hover:border-accent disabled:opacity-50"
              >
                {state?.status === "generating"
                  ? "Generating…"
                  : `Download ${item.label}`}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted">
        This backup is for archival. LifeOS does not currently support restoring
        it automatically.
      </p>
    </div>
  );
}
