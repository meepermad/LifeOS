import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDraft,
  loadDraft,
  saveDraft,
} from "@/lib/pwa/draft-recovery";
import {
  FeedbackCopy,
  PendingLabels,
  classifyRouteError,
  safeErrorMessage,
} from "@/lib/ui/feedback-copy";

describe("feedback copy", () => {
  it("hides database-looking errors", () => {
    expect(safeErrorMessage(new Error("permission denied for table events"))).toBe(
      FeedbackCopy.couldNotSave,
    );
  });

  it("classifies connection errors", () => {
    expect(classifyRouteError(new Error("network offline"))).toBe("connection");
  });

  it("exposes pending vocabulary", () => {
    expect(PendingLabels.synchronizingCanvas).toContain("Canvas");
  });
});

describe("draft recovery", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    });
  });

  it("scopes drafts by user and expires them", () => {
    const userId = "user-a";
    const formId = "work-week:test";
    saveDraft(userId, formId, { days: [] }, 1000);
    expect(loadDraft(userId, formId)).toEqual({ days: [] });
    expect(loadDraft("user-b", formId)).toBeNull();
    clearDraft(userId, formId);
    expect(loadDraft(userId, formId)).toBeNull();
  });
});
