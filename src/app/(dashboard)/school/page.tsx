import { SchoolSetup } from "@/components/school/school-setup";
import { listAcademicPresets } from "@/lib/academic/presets";
import { getActiveTerm } from "@/lib/academic/active-term";
import { listAcademicTerms } from "@/lib/data/academic/terms";
import { ensureUserInitialized } from "@/lib/data/bootstrap";

export default async function SchoolPage() {
  await ensureUserInitialized();
  const terms = await listAcademicTerms();
  const active = getActiveTerm(terms);
  const presets = listAcademicPresets();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">School</h1>
        <p className="mt-1 text-sm text-muted">
          Set up your semester, courses, class meetings, and academic breaks.
        </p>
      </div>
      <SchoolSetup
        terms={terms}
        presets={presets}
        initialTermId={active?.id ?? terms[0]?.id ?? null}
      />
    </div>
  );
}
