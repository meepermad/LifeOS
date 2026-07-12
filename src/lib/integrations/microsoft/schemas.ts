import { z } from "zod";
import type { ConnectionStatus } from "@/types/domain";

export const syncResultSchema = z.object({
  created: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  unchanged: z.number().int().nonnegative(),
  cancelled: z.number().int().nonnegative(),
  warnings: z.number().int().nonnegative(),
});

export type SyncResult = z.infer<typeof syncResultSchema>;

export const microsoftCalendarSyncResultSchema = z.object({
  calendarId: z.string().uuid(),
  calendarLabel: z.string(),
  events: syncResultSchema,
  success: z.boolean(),
  error: z.string().nullable(),
});

export type MicrosoftCalendarSyncResult = z.infer<
  typeof microsoftCalendarSyncResultSchema
>;

export const microsoftSyncResultSchema = z.object({
  calendars: z.array(microsoftCalendarSyncResultSchema),
  events: syncResultSchema,
  warnings: z.number().int().nonnegative(),
});

export type MicrosoftSyncResult = z.infer<typeof microsoftSyncResultSchema>;

export type SafeMicrosoftConnectionStatus = {
  isConfigured: boolean;
  displayLabel: string | null;
  status: ConnectionStatus;
  requiresReauthentication: boolean;
  lastSyncAttempt: string | null;
  lastSuccessfulSync: string | null;
  lastSyncTrigger: "manual" | "scheduled" | null;
  lastError: string | null;
};

export type SafeMicrosoftCalendar = {
  id: string;
  name: string;
  externalCalendarId: string;
  isPrimary: boolean;
  syncEnabled: boolean;
  isVisible: boolean;
  isUnavailable: boolean;
};

export type NormalizedMicrosoftEvent = {
  externalEventId: string;
  iCalUId: string | null;
  title: string;
  location: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  status: "confirmed" | "cancelled" | "tentative";
  eventType: "class" | "meeting" | "appointment" | "other";
  blocksTime: boolean;
  externalUpdatedAt: string | null;
  externalChangeKey: string | null;
  showAs: string | null;
  sensitivity: string | null;
  organizerName: string | null;
  onlineMeetingUrl: string | null;
  contentHash: string;
  isRemoved: boolean;
};

export const graphDateTimeZoneSchema = z.object({
  dateTime: z.string(),
  timeZone: z.string(),
});

export const graphOnlineMeetingSchema = z
  .object({
    joinUrl: z.string().optional(),
  })
  .passthrough();

export const graphOrganizerSchema = z
  .object({
    emailAddress: z
      .object({
        name: z.string().optional(),
        address: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

export const graphEventSchema = z
  .object({
    id: z.string(),
    iCalUId: z.string().optional(),
    subject: z.string().optional(),
    bodyPreview: z.string().optional(),
    start: graphDateTimeZoneSchema,
    end: graphDateTimeZoneSchema,
    isAllDay: z.boolean().optional(),
    isCancelled: z.boolean().optional(),
    showAs: z.string().optional(),
    sensitivity: z.string().optional(),
    location: z
      .object({
        displayName: z.string().optional(),
      })
      .optional(),
    organizer: graphOrganizerSchema.optional(),
    onlineMeeting: graphOnlineMeetingSchema.optional(),
    onlineMeetingUrl: z.string().optional(),
    lastModifiedDateTime: z.string().optional(),
    changeKey: z.string().optional(),
    type: z.string().optional(),
    "@removed": z.object({ reason: z.string().optional() }).optional(),
  })
  .passthrough();

export const graphEventListSchema = z.object({
  value: z.array(graphEventSchema),
  "@odata.nextLink": z.string().optional(),
  "@odata.deltaLink": z.string().optional(),
});

export type GraphEvent = z.infer<typeof graphEventSchema>;

export const graphCalendarSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    isDefaultCalendar: z.boolean().optional(),
    canEdit: z.boolean().optional(),
  })
  .passthrough();

export const graphCalendarListSchema = z.object({
  value: z.array(graphCalendarSchema),
  "@odata.nextLink": z.string().optional(),
});

export type GraphCalendar = z.infer<typeof graphCalendarSchema>;

export const oauthTransactionSchema = z.object({
  state: z.string(),
  nonce: z.string(),
  codeVerifier: z.string(),
  expiresAt: z.number(),
  consumed: z.boolean().optional(),
});

export type OAuthTransaction = z.infer<typeof oauthTransactionSchema>;
