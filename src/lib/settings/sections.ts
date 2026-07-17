export const SETTINGS_SECTIONS = [
  {
    id: "general",
    title: "General",
    description: "Profile, week start, and Home Screen install.",
  },
  {
    id: "school",
    title: "School",
    description: "Semester, courses, class meetings, and Canvas review.",
  },
  {
    id: "planning",
    title: "Planning",
    description: "Calendars, availability windows, and planning preferences.",
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Web Push alerts, quiet hours, and device subscriptions.",
  },
  {
    id: "integrations",
    title: "Integrations",
    description: "Canvas and Microsoft connection status.",
  },
  {
    id: "shortcuts",
    title: "Siri & Shortcuts",
    description: "Apple Shortcuts devices and command endpoint.",
  },
  {
    id: "data",
    title: "Data & Export",
    description: "Download read-only copies of your planning data.",
  },
  {
    id: "advanced",
    title: "Advanced",
    description: "Assistant language fallback and system status.",
  },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];

const SECTION_IDS = new Set<string>(SETTINGS_SECTIONS.map((s) => s.id));

/** Map legacy ?section= query values to canonical section ids. */
export function mapLegacySettingsSection(
  section: string | undefined,
): SettingsSectionId | null {
  if (!section) return null;
  if (SECTION_IDS.has(section)) return section as SettingsSectionId;
  // Historical aliases
  if (section === "profile" || section === "pwa") return "general";
  if (section === "connections") return "integrations";
  if (section === "export") return "data";
  if (section === "assistant" || section === "ai") return "advanced";
  if (section === "calendars" || section === "availability") return "planning";
  return null;
}

export function isSettingsSectionId(value: string): value is SettingsSectionId {
  return SECTION_IDS.has(value);
}

export function getSettingsSection(
  id: SettingsSectionId,
): (typeof SETTINGS_SECTIONS)[number] {
  const found = SETTINGS_SECTIONS.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown settings section: ${id}`);
  return found;
}

export const SETTINGS_PAGES_FOR_SEARCH = SETTINGS_SECTIONS.map((section) => ({
  id: `settings-${section.id}`,
  category: "page" as const,
  title: `Settings · ${section.title}`,
  subtitle: section.description,
  href: `/settings/${section.id}`,
}));
