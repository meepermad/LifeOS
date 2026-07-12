import { DatabaseError, ConflictError } from "@/lib/errors/app-error";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { createClient } from "@/lib/supabase/server";
import {
  clarificationExpiresAt,
  proposedActionExpiresAt,
} from "@/lib/assistant/clarification";
import type { ClarificationState } from "@/lib/assistant/intents";
import type {
  AssistantActionRow,
  AssistantMessageRow,
  AssistantThreadRow,
} from "@/types/domain";
import type { Json } from "@/types/database.types";

export type AssistantActionPreview = {
  id: string;
  actionType: string;
  status: string;
  proposedPayload: Record<string, unknown>;
  expiresAt: string | null;
  content: string;
  structuredPayload: Record<string, unknown>;
  messageType: string;
};

const MESSAGE_LIMIT = 200;

function parseActionRow(data: unknown): AssistantActionRow {
  if (!data || typeof data !== "object") {
    throw new DatabaseError("Invalid assistant action response");
  }
  return data as AssistantActionRow;
}

function parseExecuteActionResult(data: unknown): {
  action: AssistantActionRow;
  idempotent: boolean;
} {
  if (!data || typeof data !== "object") {
    throw new DatabaseError("Invalid execute assistant action response");
  }

  const result = data as {
    success?: boolean;
    idempotent?: boolean;
    action?: AssistantActionRow;
  };

  if (!result.action) {
    throw new DatabaseError("Invalid execute assistant action response");
  }

  return {
    action: result.action,
    idempotent: result.idempotent ?? false,
  };
}

export async function getOrCreateActiveThread(): Promise<AssistantThreadRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("assistant_threads")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new DatabaseError("Failed to load assistant thread");
  }

  if (existing) {
    return existing;
  }

  const { data, error } = await supabase
    .from("assistant_threads")
    .insert({
      user_id: user.id,
      title: "LifeOS Assistant",
      is_active: true,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to create assistant thread");
  }

  return data;
}

export async function listThreadMessages(
  threadId: string,
  limit = MESSAGE_LIMIT,
): Promise<AssistantMessageRow[]> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("assistant_messages")
    .select("*")
    .eq("user_id", user.id)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new DatabaseError("Failed to load assistant messages");
  }

  return data ?? [];
}

export async function insertMessage(input: {
  threadId: string;
  role: "user" | "assistant";
  messageType: string;
  content: string;
  structuredPayload?: Record<string, unknown> | null;
}): Promise<AssistantMessageRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("assistant_messages")
    .insert({
      user_id: user.id,
      thread_id: input.threadId,
      role: input.role,
      message_type: input.messageType,
      content: input.content,
      structured_payload: (input.structuredPayload ?? null) as Json,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to save assistant message");
  }

  await supabase
    .from("assistant_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", input.threadId)
    .eq("user_id", user.id);

  return data;
}

export async function expireStaleActions(threadId: string): Promise<void> {
  await requireAllowedUser();
  const supabase = await createClient();

  const { error } = await supabase.rpc("expire_stale_assistant_actions", {
    p_thread_id: threadId,
  });

  if (error) {
    throw new DatabaseError("Failed to expire stale assistant actions");
  }
}

export async function getPendingClarification(
  threadId: string,
): Promise<AssistantActionRow | null> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("assistant_actions")
    .select("*")
    .eq("user_id", user.id)
    .eq("thread_id", threadId)
    .eq("status", "awaiting_clarification")
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new DatabaseError("Failed to load clarification state");
  }

  return data;
}

export async function getPendingProposedAction(
  threadId: string,
): Promise<AssistantActionPreview | null> {
  const user = await requireAllowedUser();
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("assistant_actions")
    .select("*")
    .eq("user_id", user.id)
    .eq("thread_id", threadId)
    .eq("status", "proposed")
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new DatabaseError("Failed to load pending action");
  }

  if (!data) return null;

  const { data: message } = await supabase
    .from("assistant_messages")
    .select("*")
    .eq("id", data.source_message_id ?? "")
    .maybeSingle();

  return {
    id: data.id,
    actionType: data.action_type,
    status: data.status,
    proposedPayload: data.proposed_payload as Record<string, unknown>,
    expiresAt: data.expires_at,
    content: message?.content ?? "",
    structuredPayload:
      (message?.structured_payload as Record<string, unknown>) ?? {},
    messageType: message?.message_type ?? "action_preview",
  };
}

export async function supersedePendingActions(threadId: string): Promise<void> {
  await requireAllowedUser();
  const supabase = await createClient();

  const { error } = await supabase.rpc("reject_pending_assistant_actions", {
    p_thread_id: threadId,
  });

  if (error) {
    throw new DatabaseError("Failed to reject pending assistant actions");
  }
}

export async function createAssistantAction(input: {
  threadId: string;
  sourceMessageId?: string;
  actionType: string;
  status: string;
  proposedPayload: Record<string, unknown>;
  clarificationState?: ClarificationState | null;
  expiresAt?: string;
}): Promise<AssistantActionRow> {
  await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_assistant_action", {
    p_thread_id: input.threadId,
    p_source_message_id: input.sourceMessageId ?? undefined,
    p_action_type: input.actionType,
    p_status: input.status,
    p_proposed_payload: input.proposedPayload as Json,
    p_clarification_state: (input.clarificationState ?? null) as Json,
    p_expires_at:
      input.expiresAt ??
      (input.status === "awaiting_clarification"
        ? clarificationExpiresAt()
        : proposedActionExpiresAt()),
  });

  if (error || !data) {
    throw new DatabaseError("Failed to create assistant action");
  }

  return parseActionRow(data);
}

export async function getActionById(
  actionId: string,
): Promise<AssistantActionRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("assistant_actions")
    .select("*")
    .eq("id", actionId)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    throw new DatabaseError("Assistant action not found");
  }

  return data;
}

export async function markActionExecuted(
  actionId: string,
  executedPayload: Record<string, unknown>,
): Promise<AssistantActionRow> {
  await requireAllowedUser();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("execute_assistant_action", {
    p_action_id: actionId,
    p_executed_payload: executedPayload as Json,
  });

  if (error) {
    if (error.message.includes("expired")) {
      throw new ConflictError("This action has expired. Please try again.");
    }
    if (error.message.includes("not confirmable")) {
      throw new ConflictError("Action is no longer available to confirm");
    }
    throw new DatabaseError("Failed to update assistant action");
  }

  if (!data) {
    throw new DatabaseError("Failed to update assistant action");
  }

  const result = parseExecuteActionResult(data);
  return result.action;
}

export async function rejectAction(actionId: string): Promise<void> {
  await requireAllowedUser();
  const supabase = await createClient();

  const { error } = await supabase.rpc("reject_assistant_action", {
    p_action_id: actionId,
  });

  if (error) {
    if (error.message.includes("cannot be rejected")) {
      throw new ConflictError("Executed assistant actions cannot be rejected");
    }
    throw new DatabaseError("Failed to reject assistant action");
  }
}

export async function archiveThreadAndStartFresh(): Promise<AssistantThreadRow> {
  const user = await requireAllowedUser();
  const supabase = await createClient();

  const thread = await getOrCreateActiveThread();

  const { error: rejectError } = await supabase.rpc(
    "reject_pending_assistant_actions",
    { p_thread_id: thread.id },
  );

  if (rejectError) {
    throw new DatabaseError("Failed to reject pending assistant actions");
  }

  await supabase
    .from("assistant_threads")
    .update({ is_active: false })
    .eq("id", thread.id)
    .eq("user_id", user.id);

  const { data, error } = await supabase
    .from("assistant_threads")
    .insert({
      user_id: user.id,
      title: "LifeOS Assistant",
      is_active: true,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to create new assistant thread");
  }

  return data;
}

export function clarificationStateFromAction(
  action: AssistantActionRow,
): ClarificationState | null {
  if (!action.clarification_state) return null;
  return action.clarification_state as unknown as ClarificationState;
}
