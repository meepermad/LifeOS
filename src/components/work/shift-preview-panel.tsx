import type { WorkSchedulePreview } from "@/lib/actions/work-schedule";
import { SectionCard } from "@/components/forms/ui";

export function ShiftPreviewPanel({ preview }: { preview: WorkSchedulePreview }) {
  return (
    <SectionCard title="Preview" description="Review before saving.">
      <div className="space-y-4 text-sm">
        {preview.previewText ? (
          <pre className="whitespace-pre-wrap rounded-lg bg-surface p-3 text-foreground">
            {preview.previewText}
          </pre>
        ) : (
          <p className="text-muted">No shifts in this draft.</p>
        )}

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div>
            <dt className="text-muted">Created</dt>
            <dd>{preview.summary.created}</dd>
          </div>
          <div>
            <dt className="text-muted">Updated</dt>
            <dd>{preview.summary.updated}</dd>
          </div>
          <div>
            <dt className="text-muted">Unchanged</dt>
            <dd>{preview.summary.unchanged}</dd>
          </div>
          <div>
            <dt className="text-muted">Conflicts</dt>
            <dd>{preview.conflicts.length}</dd>
          </div>
        </dl>

        {preview.conflicts.length > 0 && (
          <div>
            <h4 className="font-medium text-danger">Conflicts</h4>
            <ul className="mt-1 list-disc pl-5 text-muted">
              {preview.conflicts.map((conflict) => (
                <li key={`${conflict.shiftDateKey}-${conflict.message}`}>
                  {conflict.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
