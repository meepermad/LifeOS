import Link from "next/link";
import { SETTINGS_SECTIONS } from "@/lib/settings/sections";
import { NavIcon, type NavIconKey } from "@/components/icons/nav-icon";

const SECTION_ICONS: Record<(typeof SETTINGS_SECTIONS)[number]["id"], NavIconKey> =
  {
    general: "general",
    school: "school",
    planning: "planning",
    notifications: "notifications",
    integrations: "integrations",
    shortcuts: "shortcuts",
    data: "data",
    advanced: "advanced",
  };

export function SettingsHub() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Configure LifeOS for daily planning, school, and integrations.
        </p>
      </div>

      <nav aria-label="Settings sections">
        <ul className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
          {SETTINGS_SECTIONS.map((section) => (
            <li key={section.id}>
              <Link
                href={`/settings/${section.id}`}
                className="flex min-h-11 items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-accent hover:bg-surface-elevated"
              >
                <NavIcon
                  name={SECTION_ICONS[section.id]}
                  className="mt-0.5 h-5 w-5 shrink-0 text-accent"
                />
                <span>
                  <span className="block text-sm font-medium text-foreground">
                    {section.title}
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    {section.description}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
