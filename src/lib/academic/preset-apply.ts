import { getAcademicPreset } from "@/lib/academic/presets";
import type { PresetTerm } from "@/lib/academic/presets/schema";
import type {
  AcademicExceptionRow,
  AcademicTermRow,
} from "@/types/domain";

export type PresetApplyResult = {
  term: Partial<AcademicTermRow>;
  exceptions: Array<
    Omit<AcademicExceptionRow, "id" | "user_id" | "created_at" | "updated_at" | "academic_term_id" | "course_id">
  >;
};

export function buildTermFromPreset(input: {
  presetKey: string;
  termKey: string;
  importedAt: string;
}): PresetApplyResult | null {
  const preset = getAcademicPreset(input.presetKey);
  if (!preset) return null;

  const termDef = preset.terms.find((t) => t.key === input.termKey);
  if (!termDef) return null;

  return {
    term: {
      name: termDef.name,
      institution: termDef.institution,
      term_type: termDef.termType,
      start_date: termDef.startDate,
      end_date: termDef.endDate,
      classes_start: termDef.classesStart,
      classes_end: termDef.classesEnd,
      finals_start: termDef.finalsStart ?? null,
      finals_end: termDef.finalsEnd ?? null,
      timezone: termDef.timezone,
      status: "draft",
      source_preset_key: preset.key,
      source_preset_revision: preset.revisionDate,
      source_preset_imported_at: input.importedAt,
      source_metadata: {
        sourceUrl: preset.sourceUrl,
        sourcePdfUrl: preset.sourcePdfUrl ?? null,
        revisionDate: preset.revisionDate,
      },
    },
    exceptions: termDef.exceptions.map((exception) => ({
      exception_type: exception.exceptionType,
      start_date: exception.startDate,
      end_date: exception.endDate,
      suppresses_classes: exception.suppressesClasses,
      blocks_availability: exception.blocksAvailability,
      informational_only: exception.informationalOnly,
      title: exception.title,
      notes: null,
      altered_schedule: null,
      preset_key: exception.key,
      is_user_modified: false,
    })),
  };
}

export function mergePresetExceptions(input: {
  existing: AcademicExceptionRow[];
  fromPreset: PresetApplyResult["exceptions"];
}): PresetApplyResult["exceptions"] {
  const toInsert: PresetApplyResult["exceptions"] = [];

  for (const exception of input.fromPreset) {
    const existing = input.existing.find(
      (row) => row.preset_key === exception.preset_key,
    );
    if (existing?.is_user_modified) continue;
    if (existing) continue;
    toInsert.push(exception);
  }

  return toInsert;
}

export function listPresetTerms(presetKey: string): PresetTerm[] {
  const preset = getAcademicPreset(presetKey);
  return preset?.terms ?? [];
}
