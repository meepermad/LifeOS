import { DatabaseError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";

export type PlanningBlockFeedback = "completed" | "partial" | "skipped" | "rescheduled";

export type PlanningFeedbackRow = {
  id: string;
  event_id: string;
  proposal_id: string | null;
  feedback: PlanningBlockFeedback;
  note: string | null;
  partial_minutes: number | null;
  created_at: string;
};

export async function upsertPlanningBlockFeedback(input: {
  eventId: string;
  feedback: PlanningBlockFeedback;
  note?: string | null;
  partialMinutes?: number | null;
  proposalId?: string | null;
}): Promise<PlanningFeedbackRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("planning_block_feedback")
    .select("*")
    .eq("user_id", user.id)
    .eq("event_id", input.eventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("planning_block_feedback")
      .update({
        feedback: input.feedback,
        note: input.note ?? existing.note,
        partial_minutes: input.partialMinutes ?? existing.partial_minutes,
        proposal_id: input.proposalId ?? existing.proposal_id,
      })
      .eq("id", existing.id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error || !data) {
      throw new DatabaseError("Failed to update planning feedback");
    }
    return data as PlanningFeedbackRow;
  }

  const { data, error } = await supabase
    .from("planning_block_feedback")
    .insert({
      user_id: user.id,
      event_id: input.eventId,
      feedback: input.feedback,
      note: input.note ?? null,
      partial_minutes: input.partialMinutes ?? null,
      proposal_id: input.proposalId ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to save planning feedback");
  }

  return data as PlanningFeedbackRow;
}

export async function getPlanningFeedbackForEvent(
  eventId: string,
): Promise<PlanningFeedbackRow | null> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("planning_block_feedback")
    .select("*")
    .eq("user_id", user.id)
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new DatabaseError("Failed to load planning feedback");
  }

  return (data as PlanningFeedbackRow | null) ?? null;
}
