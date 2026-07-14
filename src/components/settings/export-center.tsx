const exports = [
  {
    href: "/api/export/calendar.ics",
    label: "Calendar (.ics)",
    description: "Visible calendar events, including work shifts. Cancelled events are excluded.",
  },
  {
    href: "/api/export/tasks.csv",
    label: "Tasks (.csv)",
    description:
      "Columns: title, status, due date, estimate, reviewed actual time, course/category, workflow state, completion date.",
  },
  {
    href: "/api/export/time.csv",
    label: "Time (.csv)",
    description: "Columns: task, start, end, reviewed duration, source, review state.",
  },
  {
    href: "/api/export/work.csv",
    label: "Work (.csv)",
    description:
      "Columns: employer, role, date, start, end, break, scheduled hours, location.",
  },
  {
    href: "/api/export/backup.json",
    label: "Full backup (.json)",
    description: "Versioned archive of your planning data, capped at 5,000 records per collection.",
  },
] as const;

export function ExportCenter() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Downloads are generated from your account only and are not retained by LifeOS.
      </p>
      <ul className="space-y-2">
        {exports.map((item) => (
          <li
            key={item.href}
            className="flex flex-col gap-2 rounded-lg border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-xs text-muted">{item.description}</p>
            <a
              href={item.href}
              className="shrink-0 text-sm font-medium text-accent hover:text-accent-hover"
            >
              Download {item.label}
            </a>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        This backup is for archival. LifeOS does not currently support restoring it automatically.
      </p>
    </div>
  );
}
