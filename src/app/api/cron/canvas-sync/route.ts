import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/notifications/cron-auth";
import { syncCanvasForUser } from "@/lib/integrations/canvas/sync";
import { listConnectedCanvasConnections } from "@/lib/integrations/canvas/sync-data";
import { getCronSecret } from "@/lib/security/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorResponse } from "@/lib/errors/error-response";
import { AuthenticationError } from "@/lib/errors/app-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type CanvasCronSyncResponse = {
  connectionsProcessed: number;
  connectionsSucceeded: number;
  connectionsFailed: number;
  eventsCreated: number;
  eventsUpdated: number;
  tasksCreated: number;
  tasksUpdated: number;
  warnings: number;
};

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    const cronSecret = getCronSecret();

    if (!verifyCronSecret(authorization, cronSecret)) {
      throw new AuthenticationError("Invalid cron credentials");
    }

    const admin = createAdminClient();
    const ctx = { client: admin, userId: "" };

    const connections = await listConnectedCanvasConnections(ctx);

    const response: CanvasCronSyncResponse = {
      connectionsProcessed: connections.length,
      connectionsSucceeded: 0,
      connectionsFailed: 0,
      eventsCreated: 0,
      eventsUpdated: 0,
      tasksCreated: 0,
      tasksUpdated: 0,
      warnings: 0,
    };

    for (const connection of connections) {
      try {
        const result = await syncCanvasForUser({
          ctx: { client: admin, userId: connection.user_id },
          connectionId: connection.id,
          trigger: "scheduled",
        });

        response.connectionsSucceeded += 1;
        response.eventsCreated += result.events.created;
        response.eventsUpdated += result.events.updated;
        response.tasksCreated += result.tasks.created;
        response.tasksUpdated += result.tasks.updated;
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
