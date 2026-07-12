import { DatabaseError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import type { CanvasMeetingCandidate } from "@/lib/academic/canvas-candidates";

export type CanvasLinkResolutionMode = "link_suppress" | "link_only" | "ignored";

export type CanvasLinkDecisionRow = {
  id: string;
  user_id: string;
  class_meeting_id: string | null;
  academic_term_id: string;
  resolution_mode: CanvasLinkResolutionMode;
  candidate_fingerprint: string;
  canvas_course_id: string | null;
  created_at: string;
  reversed_at: string | null;
};

export async function listActiveCanvasLinkDecisions(
  termId: string,
): Promise<CanvasLinkDecisionRow[]> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("canvas_class_link_decisions")
    .select("*")
    .eq("user_id", user.id)
    .eq("academic_term_id", termId)
    .is("reversed_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new DatabaseError("Failed to load canvas link decisions");
  }

  return (data ?? []) as CanvasLinkDecisionRow[];
}

export async function listIgnoredCandidateFingerprints(
  termId: string,
): Promise<Set<string>> {
  const decisions = await listActiveCanvasLinkDecisions(termId);
  return new Set(
    decisions
      .filter((d) => d.resolution_mode === "ignored")
      .map((d) => d.candidate_fingerprint),
  );
}

export async function listActiveSuppressedCanvasUids(): Promise<Set<string>> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("canvas_suppressed_occurrences")
    .select("canvas_external_event_id")
    .eq("user_id", user.id)
    .is("reversed_at", null);

  if (error) {
    throw new DatabaseError("Failed to load suppressed canvas uids");
  }

  return new Set(
    (data ?? []).map((row) => row.canvas_external_event_id),
  );
}

export async function listActiveSuppressedCanvasUidsForUser(
  userId: string,
): Promise<Set<string>> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("canvas_suppressed_occurrences")
    .select("canvas_external_event_id")
    .eq("user_id", userId)
    .is("reversed_at", null);

  if (error) {
    throw new DatabaseError("Failed to load suppressed canvas uids");
  }

  return new Set(
    (data ?? []).map((row) => row.canvas_external_event_id),
  );
}

export async function createCanvasLinkDecision(input: {
  termId: string;
  classMeetingId: string | null;
  resolutionMode: CanvasLinkResolutionMode;
  candidateFingerprint: string;
  canvasCourseId?: string | null;
  canvasUids: string[];
  suppressUids?: string[];
}): Promise<string> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data: decision, error: decisionError } = await supabase
    .from("canvas_class_link_decisions")
    .insert({
      user_id: user.id,
      class_meeting_id: input.classMeetingId,
      academic_term_id: input.termId,
      resolution_mode: input.resolutionMode,
      candidate_fingerprint: input.candidateFingerprint,
      canvas_course_id: input.canvasCourseId ?? null,
    })
    .select("id")
    .single();

  if (decisionError || !decision) {
    throw new DatabaseError("Failed to create canvas link decision");
  }

  if (input.canvasUids.length > 0) {
    const { error: uidError } = await supabase.from("canvas_class_link_uids").insert(
      input.canvasUids.map((uid) => ({
        decision_id: decision.id,
        canvas_external_event_id: uid,
      })),
    );
    if (uidError) {
      throw new DatabaseError("Failed to store canvas link uids");
    }
  }

  if (input.suppressUids && input.suppressUids.length > 0 && input.classMeetingId) {
    const meetingId = input.classMeetingId;
    const { error: suppressError } = await supabase
      .from("canvas_suppressed_occurrences")
      .insert(
        input.suppressUids.map((uid) => ({
          user_id: user.id,
          class_meeting_id: meetingId,
          decision_id: decision.id,
          canvas_external_event_id: uid,
        })),
      );
    if (suppressError) {
      throw new DatabaseError("Failed to store canvas suppressions");
    }
  }

  return decision.id;
}

export async function reverseCanvasLinkDecision(decisionId: string): Promise<void> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error: decisionError } = await supabase
    .from("canvas_class_link_decisions")
    .update({ reversed_at: now })
    .eq("id", decisionId)
    .eq("user_id", user.id);

  if (decisionError) {
    throw new DatabaseError("Failed to reverse canvas link decision");
  }

  const { error: suppressError } = await supabase
    .from("canvas_suppressed_occurrences")
    .update({ reversed_at: now })
    .eq("decision_id", decisionId)
    .eq("user_id", user.id);

  if (suppressError) {
    throw new DatabaseError("Failed to reverse canvas suppressions");
  }
}

export function candidateFingerprint(candidate: CanvasMeetingCandidate): string {
  return candidate.id;
}

export function previewSuppressionUids(
  candidate: CanvasMeetingCandidate,
): string[] {
  return candidate.sourceCanvasUids;
}
