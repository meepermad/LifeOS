"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { mergeClarification } from "@/lib/assistant/clarification";
import {
  buildWritePreview,
  executeConfirmedAction,
  executeReadOnly,
  isReadOnlyIntent,
  isWriteIntent,
} from "@/lib/assistant/executor";
import { parseCommand } from "@/lib/assistant/parser";
import { validateParsedCommand, assistantMessageSchema } from "@/lib/assistant/schemas";
import { buildParseOptions } from "@/lib/actions/assistant-parse-options";
import { telemetryFromCommand } from "@/lib/assistant/parser-telemetry";
import { extractRecognizedDatePhrase } from "@/lib/assistant/academic-parser";
import { logParserOutcome } from "@/lib/data/assistant-parser-outcomes";
import { suggestIntentsForUnknown } from "@/lib/assistant/paraphrase";
import { formatUnknownResponse } from "@/lib/assistant/responses";
import { tryAiIntentRouter } from "@/lib/assistant/ai-intent-router/router";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import type { ClarificationState, ParsedCommand } from "@/lib/assistant/intents";
import {
  archiveThreadAndStartFresh,
  clarificationStateFromAction,
  createAssistantAction,
  expireStaleActions,
  getActionById,
  getOrCreateActiveThread,
  getPendingClarification,
  insertMessage,
  listThreadMessages,
  markActionExecuted,
  rejectAction,
  supersedePendingActions,
  type AssistantActionPreview,
} from "@/lib/data/assistant";
import { AppError } from "@/lib/errors/app-error";
import type { AssistantMessageRow } from "@/types/domain";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export type AssistantMessageResult = {
  messages: AssistantMessageRow[];
  pendingAction?: AssistantActionPreview | null;
  threadId: string;
};

function toActionError<T = void>(error: unknown): ActionResult<T> {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "form";
      fieldErrors[key] = issue.message;
    }
    return { success: false, error: "Validation failed", fieldErrors };
  }

  if (error instanceof AppError) {
    return { success: false, error: error.message };
  }

  if (error instanceof Error) {
    return { success: false, error: error.message };
  }

  return { success: false, error: "An unexpected error occurred" };
}

async function buildParseOptionsForAction() {
  return buildParseOptions();
}

function revalidateAssistantPaths() {
  revalidatePath("/chat");
  revalidatePath("/today");
  revalidatePath("/week");
  revalidatePath("/tasks");
}

async function loadChatState(threadId: string): Promise<AssistantMessageResult> {
  const messages = await listThreadMessages(threadId);
  const { getPendingProposedAction } = await import("@/lib/data/assistant");
  const pendingAction = await getPendingProposedAction(threadId);
  return { messages, pendingAction, threadId };
}

async function processParsedCommand(
  command: ParsedCommand,
  threadId: string,
  sourceMessageId: string,
): Promise<AssistantMessageRow[]> {
  const validated = validateParsedCommand(command);
  const outputMessages: AssistantMessageRow[] = [];

  if (isReadOnlyIntent(validated)) {
    const result = await executeReadOnly(validated);
    const assistantMessage = await insertMessage({
      threadId,
      role: "assistant",
      messageType: result.messageType,
      content: result.content,
      structuredPayload: result.structuredPayload,
    });
    outputMessages.push(assistantMessage);
    return outputMessages;
  }

  if (isWriteIntent(validated)) {
    await supersedePendingActions(threadId);
    const preview = await buildWritePreview(validated);

    if (preview.clarification) {
      await createAssistantAction({
        threadId,
        sourceMessageId,
        actionType: validated.intent,
        status: "awaiting_clarification",
        proposedPayload: preview.clarification.partial,
        clarificationState: {
          intent: validated.intent,
          partialPayload: preview.clarification.partial as ClarificationState["partialPayload"],
          missingFields: [preview.clarification.missingField as ClarificationState["missingFields"][number]],
          originatingMessageId: sourceMessageId,
          expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        },
      });

      const assistantMessage = await insertMessage({
        threadId,
        role: "assistant",
        messageType: "clarification",
        content: preview.content,
        structuredPayload: preview.structuredPayload,
      });
      outputMessages.push(assistantMessage);
      return outputMessages;
    }

    if (!preview.actionPreview) {
      const assistantMessage = await insertMessage({
        threadId,
        role: "assistant",
        messageType: preview.messageType,
        content: preview.content,
        structuredPayload: preview.structuredPayload,
      });
      outputMessages.push(assistantMessage);
      return outputMessages;
    }

    const assistantMessage = await insertMessage({
      threadId,
      role: "assistant",
      messageType: "action_preview",
      content: preview.content,
      structuredPayload: preview.structuredPayload,
    });

    await createAssistantAction({
      threadId,
      sourceMessageId: assistantMessage.id,
      actionType: preview.actionPreview.actionType,
      status: "proposed",
      proposedPayload: preview.actionPreview.proposedPayload,
    });

    outputMessages.push(assistantMessage);
    return outputMessages;
  }

  const assistantMessage = await insertMessage({
    threadId,
    role: "assistant",
    messageType: "error",
    content: "Unsupported command.",
    structuredPayload: {},
  });
  outputMessages.push(assistantMessage);
  return outputMessages;
}

export async function sendAssistantMessageAction(
  text: string,
): Promise<ActionResult<AssistantMessageResult>> {
  try {
    const parsedText = assistantMessageSchema.parse(text);
    const thread = await getOrCreateActiveThread();
    await expireStaleActions(thread.id);

    const userMessage = await insertMessage({
      threadId: thread.id,
      role: "user",
      messageType: "text",
      content: parsedText,
    });

    const pendingClarification = await getPendingClarification(thread.id);
    let parseResult;

    const parseOptions = await buildParseOptionsForAction();

    if (pendingClarification) {
      const state = clarificationStateFromAction(pendingClarification);
      if (state) {
        parseResult = mergeClarification(state, parsedText);
        if (parseResult.kind === "command") {
          await rejectAction(pendingClarification.id);
        }
      } else {
        parseResult = parseCommand(parsedText, new Date(), parseOptions);
      }
    } else {
      parseResult = parseCommand(parsedText, new Date(), parseOptions);
    }

    if (parseResult.kind === "clarification") {
      await supersedePendingActions(thread.id);
      await createAssistantAction({
        threadId: thread.id,
        sourceMessageId: userMessage.id,
        actionType: parseResult.partial.intent ?? "unknown",
        status: "awaiting_clarification",
        proposedPayload: parseResult.partial as Record<string, unknown>,
        clarificationState: {
          intent: parseResult.partial.intent ?? "unknown",
          partialPayload: parseResult.partial,
          missingFields: [parseResult.missingField],
          originatingMessageId: userMessage.id,
          expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        },
      });

      await insertMessage({
        threadId: thread.id,
        role: "assistant",
        messageType: "clarification",
        content: parseResult.prompt,
        structuredPayload: {
          partial: parseResult.partial,
          missingField: parseResult.missingField,
        },
      });

      revalidateAssistantPaths();
      return { success: true, data: await loadChatState(thread.id) };
    }

    if (parseResult.kind === "unknown") {
      const user = await requireAllowedUser();
      const aiResult = await tryAiIntentRouter({
        message: parseResult.raw,
        userId: user.id,
        parseOptions,
      });

      if (aiResult.attempted) {
        parseResult = aiResult.parseResult;
      }

      if (parseResult.kind === "unknown") {
        const phrase = extractRecognizedDatePhrase(parseResult.raw);
        const suggestions = suggestIntentsForUnknown(parseResult.raw);
        await logParserOutcome({
          normalizedIntent: null,
          success: false,
          clarificationReason: "unrecognized_command",
          dateRangeKind: null,
          weekOffset: null,
        });
        await insertMessage({
          threadId: thread.id,
          role: "assistant",
          messageType: "text",
          content: formatUnknownResponse(parseResult.raw, suggestions, phrase),
          structuredPayload: { suggestions, recognizedPhrase: phrase },
        });
        revalidateAssistantPaths();
        return { success: true, data: await loadChatState(thread.id) };
      }

      if (parseResult.kind === "clarification") {
        await supersedePendingActions(thread.id);
        await createAssistantAction({
          threadId: thread.id,
          sourceMessageId: userMessage.id,
          actionType: parseResult.partial.intent ?? "unknown",
          status: "awaiting_clarification",
          proposedPayload: parseResult.partial as Record<string, unknown>,
          clarificationState: {
            intent: parseResult.partial.intent ?? "unknown",
            partialPayload: parseResult.partial,
            missingFields: [parseResult.missingField],
            originatingMessageId: userMessage.id,
            expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
          },
        });

        await insertMessage({
          threadId: thread.id,
          role: "assistant",
          messageType: "clarification",
          content: parseResult.prompt,
          structuredPayload: {
            partial: parseResult.partial,
            missingField: parseResult.missingField,
          },
        });

        revalidateAssistantPaths();
        return { success: true, data: await loadChatState(thread.id) };
      }
    }

    if (parseResult.kind === "command") {
      const telemetry = telemetryFromCommand(parseResult.command);
      await logParserOutcome({
        normalizedIntent: parseResult.command.intent,
        success: true,
        dateRangeKind: telemetry.dateRangeKind,
        weekOffset: telemetry.weekOffset,
      });

      await processParsedCommand(
        parseResult.command,
        thread.id,
        userMessage.id,
      );
    }

    revalidateAssistantPaths();
    return { success: true, data: await loadChatState(thread.id) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function confirmAssistantActionAction(
  actionId: string,
): Promise<ActionResult<AssistantMessageResult>> {
  try {
    const thread = await getOrCreateActiveThread();
    await expireStaleActions(thread.id);
    const action = await getActionById(actionId);

    if (action.thread_id !== thread.id) {
      return { success: false, error: "Action not found" };
    }

    if (action.status === "expired") {
      return { success: false, error: "This action has expired. Please try again." };
    }

    if (action.expires_at && new Date(action.expires_at) < new Date()) {
      await rejectAction(actionId);
      return { success: false, error: "This action has expired. Please try again." };
    }

    if (action.status === "executed") {
      const result = await executeConfirmedAction({
        actionType: action.action_type,
        proposedPayload: action.proposed_payload as Record<string, unknown>,
        actionId: action.id,
        executedPayload: action.executed_payload,
        status: action.status,
      });

      await insertMessage({
        threadId: thread.id,
        role: "assistant",
        messageType: result.messageType,
        content: result.content,
        structuredPayload: result.structuredPayload,
      });

      revalidateAssistantPaths();
      return { success: true, data: await loadChatState(thread.id) };
    }

    if (action.status !== "proposed") {
      return { success: false, error: "This action cannot be confirmed." };
    }

    if (action.action_type === "clear_chat") {
      await markActionExecuted(action.id, { message: "Chat cleared." });
      await archiveThreadAndStartFresh();
      revalidateAssistantPaths();
      const newThread = await getOrCreateActiveThread();
      await insertMessage({
        threadId: newThread.id,
        role: "assistant",
        messageType: "action_result",
        content: "Chat cleared. Your events and tasks are unchanged.",
        structuredPayload: {},
      });
      return {
        success: true,
        data: { messages: await listThreadMessages(newThread.id), pendingAction: null, threadId: newThread.id },
      };
    }

    const result = await executeConfirmedAction({
      actionType: action.action_type,
      proposedPayload: action.proposed_payload as Record<string, unknown>,
      actionId: action.id,
      executedPayload: action.executed_payload,
      status: action.status,
    });

    await markActionExecuted(action.id, result.structuredPayload);

    await insertMessage({
      threadId: thread.id,
      role: "assistant",
      messageType: result.messageType,
      content: result.content,
      structuredPayload: result.structuredPayload,
    });

    revalidateAssistantPaths();
    return { success: true, data: await loadChatState(thread.id) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function cancelAssistantActionAction(
  actionId: string,
): Promise<ActionResult<AssistantMessageResult>> {
  try {
    const thread = await getOrCreateActiveThread();
    await rejectAction(actionId);

    await insertMessage({
      threadId: thread.id,
      role: "assistant",
      messageType: "text",
      content: "Cancelled.",
      structuredPayload: {},
    });

    revalidateAssistantPaths();
    return { success: true, data: await loadChatState(thread.id) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function loadAssistantChatAction(): Promise<
  ActionResult<AssistantMessageResult>
> {
  try {
    const thread = await getOrCreateActiveThread();
    await expireStaleActions(thread.id);
    return { success: true, data: await loadChatState(thread.id) };
  } catch (error) {
    return toActionError(error);
  }
}
