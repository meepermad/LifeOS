import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/notifications/cron-auth";
import { isMicrosoftIntegrationEnabled } from "@/lib/integrations/microsoft/feature-flag";
import { syncMicrosoftForUser } from "@/lib/integrations/microsoft/sync";
import { listConnectedMicrosoftConnections } from "@/lib/integrations/microsoft/sync-data";
import { getCronSecret } from "@/lib/security/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorResponse } from "@/lib/errors/error-response";
import { AuthenticationError } from "@/lib/errors/app-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type MicrosoftCronSyncResponse = {
  enabled: boolean;
  connectionsProcessed: number;
  connectionsSucceeded: number;
  connectionsFailed: number;
  calendarsProcessed: number;
  eventsCreated: number;
  eventsUpdated: number;
  eventsCancelled: number;
  eventsUnchanged: number;
  warnings: number;
};

function createDisabledCronResponse(): MicrosoftCronSyncResponse {
  return {
    enabled: false,
    connectionsProcessed: 0,
    connectionsSucceeded: 0,
    connectionsFailed: 0,
    calendarsProcessed: 0,
    eventsCreated: 0,
    eventsUpdated: 0,
    eventsCancelled: 0,
    eventsUnchanged: 0,
    warnings: 0,
  };
}

export async function POST(request: Request) {
  try {
    if (!isMicrosoftIntegrationEnabled()) {
      return NextResponse.json(createDisabledCronResponse());
    }

    const authorization = request.headers.get("authorization");
    const cronSecret = getCronSecret();

    if (!verifyCronSecret(authorization, cronSecret)) {
      throw new AuthenticationError("Invalid cron credentials");
    }

    const admin = createAdminClient();
    const ctx = { client: admin, userId: "" };
    const connections = await listConnectedMicrosoftConnections(ctx);

    const response: MicrosoftCronSyncResponse = {
      enabled: true,
      connectionsProcessed: connections.length,
      connectionsSucceeded: 0,
      connectionsFailed: 0,
      calendarsProcessed: 0,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsCancelled: 0,
      eventsUnchanged: 0,
      warnings: 0,
    };

    for (const connection of connections) {
      try {
        const result = await syncMicrosoftForUser({
          ctx: { client: admin, userId: connection.user_id },
          connectionId: connection.id,
          trigger: "scheduled",
        });

        response.connectionsSucceeded += 1;
        response.calendarsProcessed += result.calendars.length;
        response.eventsCreated += result.events.created;
        response.eventsUpdated += result.events.updated;
        response.eventsCancelled += result.events.cancelled;
        response.eventsUnchanged += result.events.unchanged;
        response.warnings += result.warnings;
      } catch {
        response.connectionsFailed += 1;
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(error);
  }
}
