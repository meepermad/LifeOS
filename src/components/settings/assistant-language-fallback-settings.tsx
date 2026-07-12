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
        When deterministic parsing cannot understand a command, LifeOS may send
        that command, the current date, and your timezone to the configured AI
        provider. Your calendar and task data are not sent.
      </p>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Status</dt>
          <dd className="text-right text-foreground">
            {status.enabled ? "Enabled" : "Disabled"}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Provider</dt>
          <dd className="text-right text-foreground">
            {status.provider ?? "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Requests used today</dt>
          <dd className="text-right text-foreground">
            {status.requestsUsedToday} / {status.dailyCap}
          </dd>
        </div>
        {status.lastSafeError ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Last safe error</dt>
            <dd className="text-right text-foreground">{status.lastSafeError}</dd>
          </div>
        ) : null}
      </dl>

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

      {testResult ? (
        <p className="text-sm text-foreground">{testResult}</p>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
