import { z } from "zod";
import type { ConnectionStatus } from "@/types/domain";

export const canvasFeedUrlSchema = z
  .string()
  .trim()
  .min(1, "Canvas feed URL is required")
  .url("Canvas feed URL must be a valid URL");

export const syncResultSchema = z.object({
  created: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  unchanged: z.number().int().nonnegative(),
  cancelled: z.number().int().nonnegative(),
  warnings: z.number().int().nonnegative(),
});

export type SyncResult = z.infer<typeof syncResultSchema>;

export const taskSyncResultSchema = z.object({
  created: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  unchanged: z.number().int().nonnegative(),
  cancelled: z.number().int().nonnegative(),
  preservedUserFields: z.number().int().nonnegative(),
});

export type TaskSyncResult = z.infer<typeof taskSyncResultSchema>;

export const canvasSyncResultSchema = z.object({
  events: syncResultSchema,
  tasks: taskSyncResultSchema,
  warnings: z.number().int().nonnegative(),
});

export type CanvasSyncResult = z.infer<typeof canvasSyncResultSchema>;

export type SafeCanvasConnectionStatus = {
  isConfigured: boolean;
  displayLabel: string | null;
  status: ConnectionStatus;
  lastSyncAttempt: string | null;
  lastSuccessfulSync: string | null;
  lastSyncTrigger: "manual" | "scheduled" | null;
  lastError: string | null;
};

export type NormalizedCanvasEvent = {
  externalEventId: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  status: "confirmed" | "cancelled" | "tentative";
  eventType: "class" | "deadline" | "other";
  externalUpdatedAt: string | null;
  contentHash: string;
};

export type ParsedFeedResult = {
  events: NormalizedCanvasEvent[];
  warnings: number;
};
