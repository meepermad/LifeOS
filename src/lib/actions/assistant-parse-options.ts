import { getProfile } from "@/lib/data/bootstrap";
import { listAcademicTerms } from "@/lib/data/academic/terms";
import { listExceptionsForTerm } from "@/lib/data/academic/exceptions";
import type { ParseCommandOptions } from "@/lib/assistant/parse-options";

export async function buildParseOptions(): Promise<ParseCommandOptions> {
  const [profile, terms] = await Promise.all([
    getProfile(),
    listAcademicTerms(),
  ]);
  const activeTerm = terms.find((term) => term.status === "active");
  const exceptions = activeTerm
    ? await listExceptionsForTerm(activeTerm.id)
    : [];
  return {
    timezone: profile.timezone,
    academicContext: {
      terms,
      exceptions,
      timezone: profile.timezone,
    },
  };
}
