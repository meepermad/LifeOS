import { z } from "zod";

export const shortcutCommandRequestSchema = z
  .object({
    command: z.string().trim().min(1).max(500),
    timezone: z.string().trim().max(64).optional(),
    clientRequestId: z.string().trim().min(1).max(128),
  })
  .strict();

export type ShortcutCommandRequest = z.infer<typeof shortcutCommandRequestSchema>;

export type ShortcutCommandStatus =
  | "completed"
  | "review_required"
  | "error";

export type ShortcutCommandResponse = {
  status: ShortcutCommandStatus;
  spokenText: string;
  displayText: string;
  openUrl: string | null;
  code?: string;
};

export const SHORTCUT_ERROR_CODES = [
  "SHORTCUT_TOKEN_INVALID",
  "SHORTCUT_TOKEN_REVOKED",
  "SHORTCUT_RATE_LIMITED",
  "COMMAND_EMPTY",
  "COMMAND_TOO_LONG",
  "COMMAND_NOT_UNDERSTOOD",
  "CLARIFICATION_REQUIRED",
  "ACTION_CREATION_FAILED",
  "SHORTCUT_INTERNAL_ERROR",
] as const;

export type ShortcutErrorCode = (typeof SHORTCUT_ERROR_CODES)[number];
