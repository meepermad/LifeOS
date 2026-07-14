"use client";

import { useEffect, useRef } from "react";
import { useOperationalState } from "@/components/pwa/operational-provider";

const DRAFT_PREFIX = "lifeos:draft:";
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type DraftEnvelope<T> = {
  userId: string;
  formId: string;
  savedAt: number;
  expiresAt: number;
  data: T;
};

function storageKey(userId: string, formId: string) {
  return `${DRAFT_PREFIX}${userId}:${formId}`;
}

export function saveDraft<T>(
  userId: string,
  formId: string,
  data: T,
  ttlMs = DEFAULT_TTL_MS,
): void {
  if (typeof window === "undefined") return;
  const envelope: DraftEnvelope<T> = {
    userId,
    formId,
    savedAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
    data,
  };
  try {
    localStorage.setItem(storageKey(userId, formId), JSON.stringify(envelope));
  } catch {
    // Ignore quota errors.
  }
}

export function loadDraft<T>(
  userId: string,
  formId: string,
): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(userId, formId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftEnvelope<T>;
    if (parsed.userId !== userId || parsed.formId !== formId) return null;
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(storageKey(userId, formId));
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function clearDraft(userId: string, formId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(storageKey(userId, formId));
}

export function useDraftRecovery<T>({
  userId,
  formId,
  value,
  onRestore,
  enabled = true,
}: {
  userId: string;
  formId: string;
  value: T;
  onRestore: (draft: T) => void;
  enabled?: boolean;
}) {
  const { markFormDirty } = useOperationalState();
  const offeredRef = useRef(false);

  useEffect(() => {
    if (!enabled || !userId || offeredRef.current) return;
    offeredRef.current = true;
    const draft = loadDraft<T>(userId, formId);
    if (!draft) return;
    const restore = window.confirm(
      "Restore unsaved draft for this form? Choose Cancel to discard it.",
    );
    if (restore) {
      onRestore(draft);
      markFormDirty(formId, true);
    } else {
      clearDraft(userId, formId);
      markFormDirty(formId, false);
    }
  }, [enabled, userId, formId, onRestore, markFormDirty]);

  useEffect(() => {
    if (!enabled || !userId) return;
    const timer = window.setTimeout(() => {
      saveDraft(userId, formId, value);
      markFormDirty(formId, true);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [enabled, userId, formId, value, markFormDirty]);
}

export function useClearDraftOnSuccess(userId: string, formId: string) {
  const { markFormDirty } = useOperationalState();
  return () => {
    clearDraft(userId, formId);
    markFormDirty(formId, false);
  };
}
