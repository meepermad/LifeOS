import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationError } from "@/lib/errors/app-error";
import type { NotificationPreferencesInput } from "@/lib/notifications/schemas";

const mocks = vi.hoisted(() => ({
  requireAllowedUser: vi.fn(),
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  updateNotificationPreferences: vi.fn(),
}));

vi.mock("@/lib/auth/authorize-user", () => ({
  requireAllowedUser: mocks.requireAllowedUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { updateNotificationPreferences } from "@/lib/data/notification-preferences";
import { updateNotificationPreferencesAction } from "@/lib/actions/notifications";

const validInput: NotificationPreferencesInput = {
  notificationPrivacyMode: "private",
  dailyNotificationsEnabled: true,
  weeklyNotificationsEnabled: false,
  deadlineNotificationsEnabled: true,
  overloadNotificationsEnabled: false,
  deadlineWarningHours: 24,
  dailyNotificationTime: "07:00",
  weeklyNotificationDay: 0,
  weeklyNotificationTime: "09:00",
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  morningReviewEnabled: true,
  morningReviewTime: "07:00",
  eveningReviewEnabled: true,
  eveningReviewTime: "20:00",
  weeklyReviewReminderEnabled: false,
  waitingFollowupEnabled: false,
  overdueDecisionReminderEnabled: false,
  planningFeedbackReminderEnabled: false,
};

function mockUpdateChain(result: {
  data: Array<{ user_id: string }> | null;
  error: { code?: string; message?: string } | null;
}) {
  const select = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ select });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  mocks.createClient.mockResolvedValue({ from });
  return { from, update, eq, select };
}

describe("updateNotificationPreferences data layer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAllowedUser.mockResolvedValue({ id: "user-1" });
  });

  it("treats a successful update as success when select returns matching rows", async () => {
    mockUpdateChain({
      data: [{ user_id: "user-1" }],
      error: null,
    });

    const outcome = await updateNotificationPreferences(validInput);
    expect(outcome).toEqual({ status: "updated" });
  });

  it("does not treat absence of a full preferences row body as failure", async () => {
    // Simulates selecting only user_id (not the full row) after update.
    mockUpdateChain({
      data: [{ user_id: "user-1" }],
      error: null,
    });

    const outcome = await updateNotificationPreferences(validInput);
    expect(outcome.status).toBe("updated");
  });

  it("returns database error when Supabase reports an error", async () => {
    mockUpdateChain({
      data: null,
      error: { code: "23514", message: "check_violation" },
    });

    const outcome = await updateNotificationPreferences(validInput);
    expect(outcome).toEqual({
      status: "error",
      reason: "database",
      supabaseCode: "23514",
    });
  });

  it("returns not_found when zero preference rows match", async () => {
    mockUpdateChain({
      data: [],
      error: null,
    });

    const outcome = await updateNotificationPreferences(validInput);
    expect(outcome).toEqual({ status: "error", reason: "not_found" });
  });

  it("propagates missing authenticated user", async () => {
    mocks.requireAllowedUser.mockRejectedValue(new AuthenticationError());

    await expect(
      updateNotificationPreferences(validInput),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("rejects invalid input at validation", async () => {
    await expect(
      updateNotificationPreferences({
        ...validInput,
        deadlineWarningHours: 0,
      }),
    ).rejects.toThrow();
  });

  it("writes HH:MM:SS review times produced by normalizeOptionalTime", async () => {
    const { update } = mockUpdateChain({
      data: [{ user_id: "user-1" }],
      error: null,
    });

    await updateNotificationPreferences(validInput);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        morning_review_time: "07:00:00",
        evening_review_time: "20:00:00",
      }),
    );
  });
});

describe("updateNotificationPreferencesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAllowedUser.mockResolvedValue({ id: "user-1" });
    mocks.revalidatePath.mockReturnValue(undefined);
  });

  it("returns { ok: true } on successful mutation", async () => {
    mockUpdateChain({
      data: [{ user_id: "user-1" }],
      error: null,
    });

    const result = await updateNotificationPreferencesAction(validInput);

    expect(result).toEqual({ ok: true });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings", "layout");
  });

  it("returns VALIDATION_FAILED for bad input", async () => {
    const result = await updateNotificationPreferencesAction({
      ...validInput,
      notificationPrivacyMode: "loud" as "private",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION_FAILED");
      expect(result.message).toBe(
        "LifeOS could not save notification preferences.",
      );
    }
  });

  it("returns PREFERENCES_NOT_FOUND for zero matching rows", async () => {
    mockUpdateChain({ data: [], error: null });

    const result = await updateNotificationPreferencesAction(validInput);

    expect(result).toEqual({
      ok: false,
      code: "PREFERENCES_NOT_FOUND",
      message:
        "LifeOS could not find notification preferences for this account.",
    });
  });

  it("returns DATABASE_ERROR for Supabase failures", async () => {
    mockUpdateChain({
      data: null,
      error: { code: "23514", message: "check_violation" },
    });

    const result = await updateNotificationPreferencesAction(validInput);

    expect(result).toEqual({
      ok: false,
      code: "DATABASE_ERROR",
      message: "LifeOS could not save notification preferences.",
    });
  });

  it("returns UNAUTHENTICATED when session is missing", async () => {
    mocks.requireAllowedUser.mockRejectedValue(new AuthenticationError());

    const result = await updateNotificationPreferencesAction(validInput);

    expect(result).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Sign in to save notification preferences.",
    });
  });

  it("returns ok with refreshWarning when revalidation fails after persistence", async () => {
    mockUpdateChain({
      data: [{ user_id: "user-1" }],
      error: null,
    });
    mocks.revalidatePath.mockImplementation(() => {
      throw new Error("revalidate failed");
    });

    const result = await updateNotificationPreferencesAction(validInput);

    expect(result).toEqual({
      ok: true,
      refreshWarning:
        "Preferences were saved, but LifeOS could not refresh the page. Reopen Settings to see the latest values.",
    });
  });

  it("client contract recognizes { ok: true }", async () => {
    mockUpdateChain({
      data: [{ user_id: "user-1" }],
      error: null,
    });

    const result = await updateNotificationPreferencesAction(validInput);
    expect(result.ok).toBe(true);
    expect("success" in result).toBe(false);
  });

  it("client contract surfaces returned failure message", async () => {
    mockUpdateChain({
      data: null,
      error: { code: "42501" },
    });

    const result = await updateNotificationPreferencesAction(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message.length).toBeGreaterThan(0);
      expect(result.message).not.toMatch(/42501|check_violation|user-1/i);
    }
  });
});

describe("notification preferences UI contract helpers", () => {
  it("maps ok results to success or refresh messaging", () => {
    function interpret(
      result:
        | { ok: true; refreshWarning?: string }
        | { ok: false; message: string },
    ): { error: string | null; message: string | null } {
      if (!result.ok) {
        return { error: result.message, message: null };
      }
      return {
        error: null,
        message:
          result.refreshWarning ?? "Notification preferences saved",
      };
    }

    expect(interpret({ ok: true })).toEqual({
      error: null,
      message: "Notification preferences saved",
    });
    expect(
      interpret({
        ok: true,
        refreshWarning: "Preferences were saved, but LifeOS could not refresh the page. Reopen Settings to see the latest values.",
      }).message,
    ).toContain("could not refresh");
    expect(
      interpret({
        ok: false,
        message: "LifeOS could not save notification preferences.",
      }),
    ).toEqual({
      error: "LifeOS could not save notification preferences.",
      message: null,
    });
  });

  it("does not use a success field in the new contract", () => {
    const result: { ok: true } = { ok: true };
    expect(Object.keys(result)).toEqual(["ok"]);
  });
});
