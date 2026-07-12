import { DatabaseError, ValidationError } from "@/lib/errors/app-error";
import type { MicrosoftSyncContext } from "@/lib/integrations/microsoft/sync-context";
import type { GraphCalendar } from "@/lib/integrations/microsoft/schemas";
import type { SafeMicrosoftCalendar } from "@/lib/integrations/microsoft/schemas";
import type { CalendarRow } from "@/types/domain";

function disambiguateCalendarName(
  name: string,
  externalCalendarId: string,
  existingNames: Set<string>,
): string {
  if (!existingNames.has(name)) {
    return name;
  }

  const suffix = externalCalendarId.slice(0, 8);
  const candidate = `${name} (${suffix})`;
  if (!existingNames.has(candidate)) {
    return candidate;
  }

  return `${name} (${suffix}…)`;
}

export async function listMicrosoftCalendarsForConnection(
  ctx: MicrosoftSyncContext,
  connectionId: string,
): Promise<CalendarRow[]> {
  const { data, error } = await ctx.client
    .from("calendars")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("connection_id", connectionId)
    .eq("source", "microsoft")
    .order("name");

  if (error) {
    throw new DatabaseError("Failed to load Microsoft calendars");
  }

  return data ?? [];
}

export async function upsertDiscoveredMicrosoftCalendars(
  ctx: MicrosoftSyncContext,
  input: {
    connectionId: string;
    calendars: GraphCalendar[];
  },
): Promise<SafeMicrosoftCalendar[]> {
  const existing = await listMicrosoftCalendarsForConnection(ctx, input.connectionId);
  const existingByExternalId = new Map(
    existing.map((calendar) => [calendar.external_calendar_id, calendar]),
  );
  const discoveredIds = new Set(input.calendars.map((calendar) => calendar.id));

  const { data: allCalendars, error: allError } = await ctx.client
    .from("calendars")
    .select("name")
    .eq("user_id", ctx.userId);

  if (allError) {
    throw new DatabaseError("Failed to load calendar names");
  }

  const usedNames = new Set((allCalendars ?? []).map((calendar) => calendar.name));
  const results: SafeMicrosoftCalendar[] = [];

  for (const graphCalendar of input.calendars) {
    const existingCalendar = existingByExternalId.get(graphCalendar.id);
    const isPrimary = Boolean(graphCalendar.isDefaultCalendar);

    if (existingCalendar) {
      const { data, error } = await ctx.client
        .from("calendars")
        .update({
          name: existingCalendar.name,
          sync_enabled: existingCalendar.sync_enabled,
          is_visible: existingCalendar.is_visible,
        })
        .eq("id", existingCalendar.id)
        .eq("user_id", ctx.userId)
        .select("*")
        .single();

      if (error || !data) {
        throw new DatabaseError("Failed to update Microsoft calendar");
      }

      results.push({
        id: data.id,
        name: data.name,
        externalCalendarId: graphCalendar.id,
        isPrimary,
        syncEnabled: data.sync_enabled,
        isVisible: data.is_visible,
        isUnavailable: false,
      });
      continue;
    }

    const baseName = graphCalendar.name.trim() || "Outlook calendar";
    const name = disambiguateCalendarName(baseName, graphCalendar.id, usedNames);
    usedNames.add(name);

    const { data, error } = await ctx.client
      .from("calendars")
      .insert({
        user_id: ctx.userId,
        connection_id: input.connectionId,
        external_calendar_id: graphCalendar.id,
        name,
        source: "microsoft",
        is_writable: false,
        is_visible: isPrimary,
        sync_enabled: isPrimary,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new DatabaseError("Failed to create Microsoft calendar");
    }

    results.push({
      id: data.id,
      name: data.name,
      externalCalendarId: graphCalendar.id,
      isPrimary,
      syncEnabled: data.sync_enabled,
      isVisible: data.is_visible,
      isUnavailable: false,
    });
  }

  for (const calendar of existing) {
    if (!calendar.external_calendar_id || discoveredIds.has(calendar.external_calendar_id)) {
      continue;
    }

    const unavailableName = calendar.name.endsWith(" (unavailable)")
      ? calendar.name
      : `${calendar.name} (unavailable)`;

    const { error } = await ctx.client
      .from("calendars")
      .update({
        name: unavailableName,
        sync_enabled: false,
        is_visible: false,
      })
      .eq("id", calendar.id)
      .eq("user_id", ctx.userId);

    if (error) {
      throw new DatabaseError("Failed to mark Microsoft calendar unavailable");
    }

    results.push({
      id: calendar.id,
      name: unavailableName,
      externalCalendarId: calendar.external_calendar_id,
      isPrimary: false,
      syncEnabled: false,
      isVisible: false,
      isUnavailable: true,
    });
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

export async function assertMicrosoftCalendarOwnership(
  ctx: MicrosoftSyncContext,
  calendarId: string,
  connectionId: string,
): Promise<CalendarRow> {
  const { data, error } = await ctx.client
    .from("calendars")
    .select("*")
    .eq("id", calendarId)
    .eq("user_id", ctx.userId)
    .eq("connection_id", connectionId)
    .eq("source", "microsoft")
    .single();

  if (error || !data) {
    throw new ValidationError("Microsoft calendar not found for this connection");
  }

  return data;
}

export async function updateMicrosoftCalendarPreferences(
  ctx: MicrosoftSyncContext,
  input: {
    connectionId: string;
    calendarId: string;
    syncEnabled?: boolean;
    isVisible?: boolean;
  },
): Promise<SafeMicrosoftCalendar> {
  await assertMicrosoftCalendarOwnership(ctx, input.calendarId, input.connectionId);

  const updates: Partial<CalendarRow> = {};
  if (typeof input.syncEnabled === "boolean") {
    updates.sync_enabled = input.syncEnabled;
  }
  if (typeof input.isVisible === "boolean") {
    updates.is_visible = input.isVisible;
  }

  const { data, error } = await ctx.client
    .from("calendars")
    .update(updates)
    .eq("id", input.calendarId)
    .eq("user_id", ctx.userId)
    .select("*")
    .single();

  if (error || !data || !data.external_calendar_id) {
    throw new DatabaseError("Failed to update Microsoft calendar preferences");
  }

  return {
    id: data.id,
    name: data.name,
    externalCalendarId: data.external_calendar_id,
    isPrimary: false,
    syncEnabled: data.sync_enabled,
    isVisible: data.is_visible,
    isUnavailable: data.name.endsWith(" (unavailable)"),
  };
}

export function toSafeMicrosoftCalendars(calendars: CalendarRow[]): SafeMicrosoftCalendar[] {
  return calendars.map((calendar) => ({
    id: calendar.id,
    name: calendar.name,
    externalCalendarId: calendar.external_calendar_id ?? "",
    isPrimary: false,
    syncEnabled: calendar.sync_enabled,
    isVisible: calendar.is_visible,
    isUnavailable: calendar.name.endsWith(" (unavailable)"),
  }));
}
