import type { WorkloadStatus } from "@/types/domain";
import { workloadStatusLabel } from "@/lib/planning/summaries";

const STATUS_STYLES: Record<WorkloadStatus, string> = {
  clear: "border-success/40 bg-success/10 text-success",
  manageable: "border-accent/40 bg-accent/10 text-accent",
  heavy: "border-warning/40 bg-warning/10 text-warning",
  overloaded: "border-danger/40 bg-danger/10 text-danger",
  no_capacity: "border-danger/40 bg-danger/10 text-danger",
  incomplete_data: "border-warning/40 bg-warning/10 text-warning",
};

export function WorkloadStatusBadge({ status }: { status: WorkloadStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}
    >
      {workloadStatusLabel(status)}
    </span>
  );
}
