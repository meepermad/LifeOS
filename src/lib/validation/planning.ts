import { z } from "zod";

export const planningPeriodTypeSchema = z.enum(["day", "week"]);

export const proposalIdSchema = z.string().uuid();

export const acceptProposalsSchema = z.object({
  proposalIds: z.array(proposalIdSchema).min(1),
});

export const regeneratePlanSchema = z.object({
  periodType: planningPeriodTypeSchema,
  weekOffset: z.number().int().optional(),
});

export const weeklyPlanSchema = z.object({
  weekOffset: z.number().int().optional(),
});

export type AcceptProposalsInput = z.infer<typeof acceptProposalsSchema>;
export type RegeneratePlanInput = z.infer<typeof regeneratePlanSchema>;
