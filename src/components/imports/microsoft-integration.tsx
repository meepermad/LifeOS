"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  disconnectMicrosoftAction,
  refreshMicrosoftCalendarsAction,
  syncMicrosoftAction,
  updateMicrosoftCalendarSelectionAction,
} from "@/lib/actions/microsoft";
import type {
  MicrosoftSyncResult,
  SafeMicrosoftCalendar,
  SafeMicrosoftConnectionStatus,
} from "@/lib/integrations/microsoft/schemas";
import {
  DangerButton,
  PrimaryButton,
  SecondaryButton,
} from "@/components/forms/ui";

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Never";
  }

  return new Date(value).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatSyncTrigger(
  trigger: SafeMicrosoftConnectionStatus["lastSyncTrigger"],
): string | null {
  if (trigger === "manual") {
    return "Manual";
  }
  if (trigger === "scheduled") {
    return "Automatic";
  }
  return null;
}

function SyncSummary({ result }: { result: MicrosoftSyncResult }) {
  return (
    <div className="rounded-lg border border-border/70 bg-surface-elevated/40 p-3 text-sm text-foreground/90">
      <p className="font-medium text-foreground">Microsoft synchronization complete</p>
      <div className="mt-3 space-y-2 text-muted">
        <p>
          Calendars processed: {result.calendars.length}
        </p>
        <p>
          Events created: {result.events.created}
        </p>
        <p>
          Events updated: {result.events.updated}
        </p>
        <p>
          Events cancelled: {result.events.cancelled}
        </p>
        <p>
          Events unchanged: {result.events.unchanged}
        </p>
        {result.warnings > 0 && <p>Warnings: {result.warnings}</p>}
      </div>
    </div>
  );
}

export function MicrosoftIntegration({
  initialStatus,
  initialCalendars,
}: {
  initialStatus: SafeMicrosoftConnectionStatus;
  initialCalendars: SafeMicrosoftCalendar[];
}) {
  const [status, setStatus] = useState(initialStatus);
  const [calendars, setCalendars] = useState(initialCalendars);
  const [syncResult, setSyncResult] = useState<MicrosoftSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSync = () => {
    setError(null);
    setSyncResult(null);
    startTransition(async () => {
      const result = await syncMicrosoftAction();
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSyncResult(result.data ?? null);
    });
  };

  const handleRefreshCalendars = () => {
    setError(null);
    startTransition(async () => {
      const result = await refreshMicrosoftCalendarsAction();
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.data) {
        setCalendars(result.data);
      }
    });
  };

  const handleDisconnect = () => {
    if (
      !window.confirm(
        "Disconnect Microsoft 365 from LifeOS? Imported Outlook events will be removed from LifeOS but nothing in Outlook will be deleted.",
      )
    ) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await disconnectMicrosoftAction();
      if (!result.success) {
        setError(result.error);
        return;
      }
      setStatus({
        isConfigured: false,
        displayLabel: null,
        status: "disconnected",
        requiresReauthentication: false,
        lastSyncAttempt: null,
        lastSuccessfulSync: null,
        lastSyncTrigger: null,
        lastError: null,
      });
      setCalendars([]);
      setSyncResult(null);
    });
  };

  const handleCalendarToggle = (
    calendarId: string,
    field: "syncEnabled" | "isVisible",
    value: boolean,
  ) => {
    setError(null);
    startTransition(async () => {
      const result = await updateMicrosoftCalendarSelectionAction({
        calendarId,
        syncEnabled: field === "syncEnabled" ? value : undefined,
        isVisible: field === "isVisible" ? value : undefined,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.data) {
        setCalendars((current) =>
          current.map((calendar) =>
            calendar.id === calendarId ? result.data! : calendar,
          ),
        );
      }
    });
  };

  if (!status.isConfigured) {
    return (
      <div className="space-y-4 text-sm">
        <p className="text-foreground/80">
          Connect your Microsoft work or school account to import Outlook calendars into
          LifeOS. LifeOS requests read-only access to calendars only.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>LifeOS does not create, edit, or delete Outlook events.</li>
          <li>Event bodies, attendees, and attachments are not stored.</li>
          <li>Your organization may need to approve calendar access.</li>
        </ul>
        <Link
          href="/api/auth/microsoft/start"
          className="inline-block w-full rounded-lg bg-accent px-4 py-2.5 text-center font-medium text-white transition-colors hover:bg-accent-hover"
        >
          Connect Microsoft 365
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      <dl className="space-y-2">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Account</dt>
          <dd className="text-right text-foreground">{status.displayLabel}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Status</dt>
          <dd className="text-right text-foreground">{status.status}</dd>
        </div>
        {status.requiresReauthentication && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-100">
            Microsoft requires reconnection before synchronization can continue.
          </p>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Last sync attempt</dt>
          <dd className="text-right text-foreground">
            {formatTimestamp(status.lastSyncAttempt)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Last successful sync</dt>
          <dd className="text-right text-foreground">
            {formatTimestamp(status.lastSuccessfulSync)}
            {formatSyncTrigger(status.lastSyncTrigger)
              ? ` (${formatSyncTrigger(status.lastSyncTrigger)})`
              : ""}
          </dd>
        </div>
        {status.lastError && (
          <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-100">
            {status.lastError}
          </p>
        )}
      </dl>

      {calendars.length > 0 && (
        <div className="space-y-3">
          <p className="font-medium text-foreground">Selected calendars</p>
          <ul className="space-y-2">
            {calendars.map((calendar) => (
              <li
                key={calendar.id}
                className="rounded-lg border border-border/70 bg-surface-elevated/30 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-medium text-foreground">{calendar.name}</span>
                  {calendar.isUnavailable && (
                    <span className="text-xs text-muted">Unavailable</span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-muted">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={calendar.syncEnabled}
                      disabled={calendar.isUnavailable || isPending}
                      onChange={(event) =>
                        handleCalendarToggle(
                          calendar.id,
                          "syncEnabled",
                          event.target.checked,
                        )
                      }
                    />
                    Sync
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={calendar.isVisible}
                      disabled={calendar.isUnavailable || isPending}
                      onChange={(event) =>
                        handleCalendarToggle(
                          calendar.id,
                          "isVisible",
                          event.target.checked,
                        )
                      }
                    />
                    Visible
                  </label>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <PrimaryButton onClick={handleSync} disabled={isPending}>
          Sync Microsoft now
        </PrimaryButton>
        <SecondaryButton onClick={handleRefreshCalendars} disabled={isPending}>
          Refresh Calendars
        </SecondaryButton>
        <Link
          href="/api/auth/microsoft/start"
          className="inline-block w-full rounded-lg border border-border px-4 py-2.5 text-center text-sm text-muted transition-colors hover:border-accent hover:text-foreground"
        >
          Connect Again
        </Link>
        <DangerButton onClick={handleDisconnect} disabled={isPending}>
          Disconnect
        </DangerButton>
      </div>

      {error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-100">
          {error}
        </p>
      )}

      {syncResult && <SyncSummary result={syncResult} />}
    </div>
  );
}
