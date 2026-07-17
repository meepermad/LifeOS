import Link from "next/link";
import { SectionCard } from "@/components/forms/ui";
import { SemesterReadinessCard } from "@/components/status/semester-readiness-card";
import {
  SettingsCardSkeleton,
  LoadingStatus,
} from "@/components/ui/skeletons";
import { Suspense } from "react";
import {
  buildSemesterReadinessChecks,
  loadSystemStatus,
} from "@/lib/status/system-status";

function formatTs(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

async function StatusPanels() {
  const status = await loadSystemStatus();
  const readiness = buildSemesterReadinessChecks(status);

  return (
    <>
      <SectionCard title="Application">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Version</dt>
            <dd>{status.appVersion}</dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard title="Integrations">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Canvas</dt>
            <dd>{status.canvasConnected ? "Connected" : "Not connected"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Last Canvas success</dt>
            <dd>{formatTs(status.canvasLastSuccessAt)}</dd>
          </div>
          {!status.canvasConnected ? (
            <Link href="/imports" className="text-sm text-accent">
              Connect Canvas
            </Link>
          ) : null}
        </dl>
      </SectionCard>

      <SectionCard title="Notifications">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Devices with push</dt>
            <dd>{status.devicePushCount}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Last notification evidence</dt>
            <dd>{formatTs(status.lastNotificationEvidenceAt)}</dd>
          </div>
          <Link href="/settings" className="text-sm text-accent">
            Review push settings
          </Link>
        </dl>
      </SectionCard>

      <SectionCard title="Work and school">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Active term</dt>
            <dd>{status.activeTermName ?? "None"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Courses</dt>
            <dd>{status.courseCount}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Work profiles</dt>
            <dd>{status.workProfilesConfigured}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Unassigned work shifts</dt>
            <dd>{status.unassignedWorkShifts}</dd>
          </div>
          {status.unassignedWorkShifts > 0 ? (
            <Link href="/work" className="text-sm text-accent">
              Assign work profiles
            </Link>
          ) : null}
        </dl>
      </SectionCard>

      <SectionCard title="Operations">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Active recurring templates</dt>
            <dd>{status.recurringTemplatesActive}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Pending reviews</dt>
            <dd>{status.pendingReviews}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Inbox items</dt>
            <dd>{status.inboxCount}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Stale timer</dt>
            <dd>{status.staleTimerOpen ? "Stale timer open" : "Clear"}</dd>
          </div>
        </dl>
      </SectionCard>

      <SemesterReadinessCard checks={readiness} forceShow />
    </>
  );
}

export default function StatusPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">System status</h1>
        <p className="mt-1 text-sm text-muted">
          Private operational visibility. No secrets or raw errors are shown.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="space-y-4">
            <LoadingStatus label="Loading status checks" />
            <SettingsCardSkeleton count={4} />
          </div>
        }
      >
        <StatusPanels />
      </Suspense>
    </div>
  );
}
