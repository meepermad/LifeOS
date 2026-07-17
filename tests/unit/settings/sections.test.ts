import { describe, expect, it } from "vitest";
import {
  isSettingsSectionId,
  mapLegacySettingsSection,
  SETTINGS_SECTIONS,
} from "@/lib/settings/sections";

describe("settings sections", () => {
  it("exposes eight hub sections", () => {
    expect(SETTINGS_SECTIONS).toHaveLength(8);
    expect(SETTINGS_SECTIONS.map((s) => s.id)).toEqual([
      "general",
      "school",
      "planning",
      "notifications",
      "integrations",
      "shortcuts",
      "data",
      "advanced",
    ]);
  });

  it("maps legacy query section aliases", () => {
    expect(mapLegacySettingsSection("notifications")).toBe("notifications");
    expect(mapLegacySettingsSection("profile")).toBe("general");
    expect(mapLegacySettingsSection("connections")).toBe("integrations");
    expect(mapLegacySettingsSection("export")).toBe("data");
    expect(mapLegacySettingsSection("assistant")).toBe("advanced");
    expect(mapLegacySettingsSection("unknown")).toBeNull();
  });

  it("validates section ids", () => {
    expect(isSettingsSectionId("planning")).toBe(true);
    expect(isSettingsSectionId("nope")).toBe(false);
  });
});
