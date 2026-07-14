import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { errorResponse } from "@/lib/errors/error-response";
import {
  buildBackup,
  MAX_BACKUP_ROWS_PER_COLLECTION,
  type BackupCollection,
} from "@/lib/export/backup";
import { exportHeaders, privateNoStoreHeaders } from "@/lib/export/headers";
import { allowExport } from "@/lib/export/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type BackupTable = keyof Database["public"]["Tables"];
type BackupQueryClient = {
  from: (table: BackupTable) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        limit: (
          count: number,
        ) => Promise<{ data: BackupCollection | null; error: unknown }>;
      };
    };
  };
};

const BACKUP_TABLES: readonly BackupTable[] = [
  "academic_exceptions",
  "academic_terms",
  "availability_rules",
  "calendars",
  "class_meetings",
  "courses",
  "daily_priorities",
  "events",
  "planning_block_feedback",
  "planning_preferences",
  "planning_proposals",
  "review_decisions",
  "review_sessions",
  "task_completion_snapshots",
  "task_due_date_revisions",
  "task_estimate_revisions",
  "task_recurrence_exceptions",
  "task_recurrence_templates",
  "task_time_entries",
  "tasks",
  "timer_pause_segments",
  "weekly_priorities",
  "work_profiles",
  "work_shift_templates",
  "workload_snapshots",
];

export async function GET() {
  try {
    const user = await requireAllowedUser();
    if (!allowExport(user.id)) {
      return new Response("Too many export requests", {
        status: 429,
        headers: privateNoStoreHeaders(),
      });
    }
    const supabase = await createClient();
    const backupClient = supabase as unknown as BackupQueryClient;
    const collections = await Promise.all(
      BACKUP_TABLES.map(async (table) => {
        const { data, error } = await backupClient
          .from(table)
          .select("*")
          .eq("user_id", user.id)
          .limit(MAX_BACKUP_ROWS_PER_COLLECTION);
        if (error) throw error;
        return [table, data ?? []] as const;
      }),
    );
    const body = JSON.stringify(buildBackup(Object.fromEntries(collections)), null, 2);
    return new Response(body, {
      headers: exportHeaders("lifeos-backup.json", "application/json"),
    });
  } catch (error) {
    const response = errorResponse(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
