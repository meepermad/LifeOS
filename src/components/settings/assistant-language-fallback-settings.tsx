"use client";

import { useState, useTransition } from "react";
import {
  getAiIntentRouterStatusAction,
  testAiIntentRouterAction,
  type AiIntentRouterStatusResult,
} from "@/lib/actions/assistant-ai";
import {
  FormField,
  inputClassName,
  PrimaryButton,
  SecondaryButton,
} from "@/components/forms/ui";

type Props = {
  initialStatus: AiIntentRouterStatusResult;
};

export function AssistantLanguageFallbackSettings({ initialStatus }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [testPhrase, setTestPhrase] = useState(
    "What am I looking at schedule-wise after this week?",
  );
  const [testResult, setTestResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function refreshStatus() {
    startTransition(async () => {
      const result = await getAiIntentRouterStatusAction();
      if (result.success && result.data) {
        setStatus(result.data);
      }
    });
  }

  function handleTest() {
    startTransition(async () => {
      setError(null);
      setTestResult(null);
      const result = await testAiIntentRouterAction(testPhrase);
      if (!result.success) {
        setError(result.error);
        return;
      }
      const data = result.data;
      if (!data) return;
      if (data.status === "unavailable") {
        setTestResult("Language fallback is unavailable.");
        await refreshStatus();
        return;
      }
      setTestResult(
        data.intent
          ? `Normalized intent: ${data.intent} (${data.status})`
          : `Result: ${data.status}`,
      );
      await refreshStatus();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Privacy: when deterministic parsing cannot understand a command, LifeOS
        may send only that command text, the current date, and your timezone to
        the configured provider. Calendar and task contents are never sent.
      </p>

      {!status.enabled ? (
        <div className="rounded-lg border border-border bg-surface-elevated/40 px-3 py-3 text-sm text-muted">
          Language fallback is disabled. Unavailable providers are hidden until a
          supported provider is configured for this environment.
        </div>
      ) : (
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Status</dt>
            <dd className="text-right text-foreground">Enabled</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Provider</dt>
            <dd className="text-right text-foreground">
              {status.provider ?? "Configured"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Daily quota</dt>
            <dd className="text-right text-foreground">
              {status.requestsUsedToday} / {status.dailyCap} used today
            </dd>
          </div>
          {status.lastSafeError ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Last usage / error</dt>
              <dd className="text-right text-foreground">{status.lastSafeError}</dd>
            </div>
          ) : (
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Last usage</dt>
              <dd className="text-right text-foreground">No recent errors</dd>
            </div>
          )}
        </dl>
      )}

      {status.enabled ? (
        <>
          <FormField label="Test phrase" htmlFor="ai-test-phrase">
            <input
              id="ai-test-phrase"
              className={inputClassName}
              value={testPhrase}
              onChange={(event) => setTestPhrase(event.target.value)}
              maxLength={500}
            />
          </FormField>

          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={handleTest} disabled={isPending}>
              Test classification
            </PrimaryButton>
            <SecondaryButton onClick={refreshStatus} disabled={isPending}>
              Refresh status
            </SecondaryButton>
          </div>
        </>
      ) : (
        <SecondaryButton onClick={refreshStatus} disabled={isPending}>
          Refresh status
        </SecondaryButton>
      )}

      {testResult ? (
        <p className="text-sm text-foreground">{testResult}</p>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
