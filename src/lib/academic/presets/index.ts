import kStatePreset from "@/lib/academic/presets/k-state-2026-2027.json";
import {
  academicPresetSchema,
  type AcademicPreset,
} from "@/lib/academic/presets/schema";

const PRESETS: Record<string, AcademicPreset> = {
  "k-state-2026-2027": academicPresetSchema.parse(kStatePreset),
};

export function listAcademicPresets(): AcademicPreset[] {
  return Object.values(PRESETS);
}

export function getAcademicPreset(key: string): AcademicPreset | null {
  return PRESETS[key] ?? null;
}

export function getPresetTerm(
  presetKey: string,
  termKey: string,
): AcademicPreset["terms"][number] | null {
  const preset = getAcademicPreset(presetKey);
  if (!preset) return null;
  return preset.terms.find((term) => term.key === termKey) ?? null;
}
