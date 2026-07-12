import { parseCommand } from "@/lib/assistant/parser";
import { validateParsedCommand } from "@/lib/assistant/schemas";
import {
  buildWritePreview,
  executeReadOnly,
  isReadOnlyIntent,
  isWriteIntent,
} from "@/lib/assistant/executor";
import { proposedActionExpiresAt } from "@/lib/assistant/clarification";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AuthenticatedShortcutDevice } from "@/lib/shortcuts/auth";
import type { ShortcutCommandResponse } from "@/lib/shortcuts/schemas";
import {
  sanitizeSpokenText,
  spokenForWritePreview,
  toSpokenResponse,
} from "@/lib/shortcuts/spoken";
import type { Json } from "@/types/database.types";
import { getServerEnv } from "@/lib/security/env";

async function getOrCreateThreadForUser(userId: string): Promise<string> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("assistant_threads")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data, error } = await admin
    .from("assistant_threads")
    .insert({
      user_id: userId,
      title: "LifeOS Assistant",
      is_active: true,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error("Failed to create assistant thread");
  }

  return data.id;
}

function countWorkShifts(content: string): number {
  const matches = content.match(/\nWork\n/g);
  return matches?.length ?? (content.includes("Work") ? 1 : 0);
}

export async function processShortcutCommand(input: {
  device: AuthenticatedShortcutDevice;
  command: string;
  timezone?: string;
}): Promise<ShortcutCommandResponse> {
  const parseResult = parseCommand(input.command);

  if (parseResult.kind === "clarification") {
    return {
      status: "error",
      code: "CLARIFICATION_REQUIRED",
      spokenText: sanitizeSpokenText(parseResult.prompt),
      displayText: "Clarification required.",
      openUrl: null,
    };
  }

  if (parseResult.kind === "unknown") {
    return {
      status: "error",
      code: "COMMAND_NOT_UNDERSTOOD",
      spokenText: "I did not understand that command.",
      displayText: "Command not understood.",
      openUrl: null,
    };
  }

  const validated = validateParsedCommand(parseResult.command);

  if (isReadOnlyIntent(validated)) {
    const result = await executeReadOnly(validated);
    const spoken = toSpokenResponse({
      content: result.content,
      detailLevel: input.device.spokenDetailLevel,
      privateText: result.content.split("\n")[0],
    });
    return {
      status: "completed",
      ...spoken,
      openUrl: null,
    };
  }

  if (!isWriteIntent(validated)) {
    return {
      status: "error",
      code: "COMMAND_NOT_UNDERSTOOD",
      spokenText: "I did not understand that command.",
      displayText: "Command not understood.",
      openUrl: null,
    };
  }

  const preview = await buildWritePreview(validated);
  if (preview.messageType === "clarification" || preview.messageType === "error") {
    return {
      status: "error",
      code:
        preview.messageType === "clarification"
          ? "CLARIFICATION_REQUIRED"
          : "ACTION_CREATION_FAILED",
      spokenText: sanitizeSpokenText(preview.content),
      displayText:
        preview.messageType === "clarification"
          ? "Clarification required."
          : "Could not prepare that action.",
      openUrl: null,
    };
  }

  const admin = createAdminClient();
  const threadId = await getOrCreateThreadForUser(input.device.userId);

  const { data: userMessage, error: userMessageError } = await admin
    .from("assistant_messages")
    .insert({
      user_id: input.device.userId,
      thread_id: threadId,
      role: "user",
      message_type: "text",
      content: input.command,
      structured_payload: { source: "shortcut" },
    })
    .select("id")
    .single();

  if (userMessageError || !userMessage) {
    throw new Error("Failed to record shortcut message");
  }

  const { data: action, error: actionError } = await admin
    .from("assistant_actions")
    .insert({
      user_id: input.device.userId,
      thread_id: threadId,
      source_message_id: userMessage.id,
      action_type: preview.actionPreview?.actionType ?? validated.intent,
      status: "proposed",
      proposed_payload: {
        ...(preview.actionPreview?.proposedPayload ?? {}),
        source: "shortcut",
      } as Json,
      idempotency_key: crypto.randomUUID(),
      expires_at: proposedActionExpiresAt(),
    })
    .select("id")
    .single();

  if (actionError || !action) {
    return {
      status: "error",
      code: "ACTION_CREATION_FAILED",
      spokenText: "I could not prepare that action for review.",
      displayText: "Action creation failed.",
      openUrl: null,
    };
  }

  await admin.from("assistant_messages").insert({
    user_id: input.device.userId,
    thread_id: threadId,
    role: "assistant",
    message_type: "action_preview",
    content: preview.content,
    structured_payload: {
      ...(preview.structuredPayload ?? {}),
      actionId: action.id,
      source: "shortcut",
    },
  });

  const appUrl = (getServerEnv().NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const shiftCount = Math.max(1, countWorkShifts(preview.content));
  const spoken = spokenForWritePreview(shiftCount);

  return {
    status: "review_required",
    spokenText: spoken.spokenText,
    displayText: spoken.displayText,
    openUrl: `${appUrl}/chat?action=${action.id}`,
  };
}
