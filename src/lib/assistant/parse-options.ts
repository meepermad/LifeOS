import type { AcademicRangeContext } from "@/lib/dates/range-parser";

export type ParseCommandOptions = {
  now?: Date;
  timezone?: string;
  academicContext?: AcademicRangeContext;
};
