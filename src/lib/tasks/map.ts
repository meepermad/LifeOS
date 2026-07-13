import type { TaskRow, WorkflowState } from "@/types/domain";
import type { Database } from "@/types/database.types";

type TaskDbRow = Database["public"]["Tables"]["tasks"]["Row"];

export function mapTaskRow(row: TaskDbRow): TaskRow {
  return {
    ...row,
    workflow_state: row.workflow_state as WorkflowState,
  };
}

export function mapTaskRows(rows: TaskDbRow[]): TaskRow[] {
  return rows.map(mapTaskRow);
}
