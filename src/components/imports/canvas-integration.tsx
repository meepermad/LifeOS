"use client";

import { useState, useTransition } from "react";
import {
  disconnectCanvasAction,
  saveCanvasFeedAction,
  syncCanvasAction,
} from "@/lib/actions/canvas";
import type {
  CanvasSyncResult,
  SafeCanvasConnectionStatus,
} from "@/lib/integrations/canvas/schemas";
import {
  DangerButton,
  FormField,
  inputClassName,
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

function formatSyncTrigger(trigger: SafeCanvasConnectionStatus["lastSyncTrigger"]): string | null {
  if (trigger === "manual") {
    return "Manual";
  }
  if (trigger === "scheduled") {
    return "Automatic";
  }
  return null;
}

function SyncSummary({ result }: { result: CanvasSyncResult }) {
  return (
    <div className="rounded-lg border border-border/70 bg-surface-elevated/40 p-3 text-sm text-foreground/90">
      <p className="font-medium text-foreground">Canvas synchronization complete</p>
      <div className="mt-3 space-y-2 text-muted">
        <div>
          <p className="font-medium text-foreground">Events</p>
          <p>
            {result.events.created} created, {result.events.updated} updated,{" "}
            {result.events.unchanged} unchanged
            {result.events.cancelled > 0 && `, ${result.events.cancelled} cancelled`}
          </p>
        </div>
        <div>
          <p className="font-medium text-foreground">Assignments</p>
          <p>
            {result.tasks.created} tasks created, {result.tasks.updated} updated,{" "}
            {result.tasks.unchanged} unchanged
            {result.tasks.cancelled > 0 && `, ${result.tasks.cancelled} cancelled`}
          </p>
          {result.tasks.preservedUserFields > 0 && (
            <p className="mt-1">
              {result.tasks.preservedUserFields} personal estimates preserved
            </p>
          )}
        </div>
        {result.warnings > 0 && <p>Warnings: {result.warnings}</p>}
      </div>
    </div>
  );
}

export function CanvasIntegration({
  initialStatus,
}: {
  initialStatus: SafeCanvasConnectionStatus;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [feedUrl, setFeedUrl] = useState("");
  const [replaceMode, setReplaceMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<CanvasSyncResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const showUrlForm = !status.isConfigured || replaceMode;

  const isSyncing = status.status === "syncing";

  function handleSave() {
    setError(null);
    setFieldError(null);
    setSyncResult(null);

    startTransition(async () => {
      const result = await saveCanvasFeedAction(feedUrl);
      if (!result.success) {
        setError(result.error);
        setFieldError(result.fieldErrors?.url ?? result.fieldErrors?.form ?? null);
        return;
      }

      if (result.data) {
        setStatus(result.data);
      }
      setFeedUrl("");
      setReplaceMode(false);
    });
  }

  function handleSync() {
    setError(null);
    setSyncResult(null);

    startTransition(async () => {
      const result = await syncCanvasAction();
      if (!result.success) {
        setError(result.error);
        setStatus((current) => ({
          ...current,
          status: "error",
          lastError: result.error,
        }));
        return;
      }

      if (result.data) {
        setSyncResult(result.data);
      }

      setStatus((current) => ({
        ...current,
        status: "connected",
        lastError: null,
        lastSuccessfulSync: new Date().toISOString(),
        lastSyncAttempt: new Date().toISOString(),
        lastSyncTrigger: "manual",
      }));
    });
  }

  function handleDisconnect() {
    if (!window.confirm("Disconnect Canvas and remove the stored feed URL?")) {
      return;
    }

    setError(null);
    setSyncResult(null);

    startTransition(async () => {
      const result = await disconnectCanvasAction();
      if (!result.success) {
        setError(result.error);
        return;
      }

      setStatus({
        isConfigured: false,
        displayLabel: null,
        status: "disconnected",
        lastSyncAttempt: null,
        lastSuccessfulSync: null,
        lastSyncTrigger: null,
        lastError: null,
      });
      setFeedUrl("");
      setReplaceMode(false);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground/80">
        Connect your private Canvas calendar feed URL. The URL is encrypted on the
        server and never shown again after saving.
      </p>

      {status.isConfigured && !showUrlForm && (
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Feed</dt>
            <dd className="text-right text-foreground">{status.displayLabel}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Status</dt>
            <dd className="text-right capitalize text-foreground">{status.status}</dd>
          </div>
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
              {status.lastSyncTrigger && (
                <span className="block text-xs text-muted">
                  {formatSyncTrigger(status.lastSyncTrigger)}
                </span>
              )}
            </dd>
          </div>
          {isSyncing && (
            <p className="text-sm text-muted">
              Canvas synchronization is already in progress.
            </p>
          )}
          <p className="text-sm text-muted">
            Canvas syncs automatically every 6 hours after deployment and cron
            configuration. Use Sync Now for an immediate refresh.
          </p>
          {status.lastError && (
            <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-danger">
              {status.lastError}
            </div>
          )}
        </dl>
      )}

      {showUrlForm && (
        <FormField label="Canvas ICS feed URL" htmlFor="canvas-feed-url" error={fieldError ?? undefined}>
          <input
            id="canvas-feed-url"
            type="password"
            autoComplete="off"
            value={feedUrl}
            onChange={(event) => setFeedUrl(event.target.value)}
            className={inputClassName}
            placeholder="https://..."
            disabled={isPending}
          />
        </FormField>
      )}

      {error && !status.lastError && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {syncResult && <SyncSummary result={syncResult} />}

      <div className="space-y-2">
        {showUrlForm ? (
          <PrimaryButton
            type="button"
            loading={isPending}
            disabled={!feedUrl.trim()}
            onClick={handleSave}
          >
            Save and Connect
          </PrimaryButton>
        ) : (
          <>
            <PrimaryButton
              type="button"
              loading={isPending}
              disabled={isSyncing}
              onClick={handleSync}
            >
              Sync Now
            </PrimaryButton>
            <SecondaryButton
              type="button"
              disabled={isPending}
              onClick={() => {
                setReplaceMode(true);
                setFeedUrl("");
                setError(null);
                setFieldError(null);
              }}
            >
              Replace Feed
            </SecondaryButton>
            <DangerButton
              disabled={isPending}
              loading={isPending}
              onClick={handleDisconnect}
            >
              Disconnect
            </DangerButton>
          </>
        )}
      </div>
    </div>
  );
}
