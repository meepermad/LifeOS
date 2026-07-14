import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getCronSecret: vi.fn(),
  getAllowedEmail: vi.fn(),
  findAllowedUserId: vi.fn(),
  processScheduledNotifications: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/lib/security/env", () => ({
  getCronSecret: mocks.getCronSecret,
  getAllowedEmail: mocks.getAllowedEmail,
}));

vi.mock("@/lib/notifications/workload-admin", () => ({
  findAllowedUserId: mocks.findAllowedUserId,
}));

vi.mock("@/lib/notifications/scheduling", () => ({
  processScheduledNotifications: mocks.processScheduledNotifications,
}));

import { POST } from "@/app/api/cron/notifications/route";

describe("POST /api/cron/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCronSecret.mockReturnValue("cron-secret");
    mocks.getAllowedEmail.mockReturnValue("user@example.com");
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(),
          })),
        })),
      })),
    });
  });

  it("rejects missing cron secret", async () => {
    const response = await POST(
      new Request("http://localhost/api/cron/notifications", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects incorrect cron secret", async () => {
    const response = await POST(
      new Request("http://localhost/api/cron/notifications", {
        method: "POST",
        headers: { authorization: "Bearer wrong-secret" },
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("returns safe aggregate counts after valid cron secret", async () => {
    const adminClient = {
      from: vi.fn((table: string) => {
        if (table === "planning_preferences") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { notifications_enabled: true },
                  error: null,
                }),
              })),
            })),
          };
        }

        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { week_starts_on: 0 },
                error: null,
              }),
            })),
          })),
        };
      }),
    };

    mocks.createAdminClient.mockReturnValue(adminClient);
    mocks.findAllowedUserId.mockResolvedValue("user-1");
    mocks.processScheduledNotifications.mockResolvedValue({
      daily: 1,
      weekly: 0,
      deadline: 0,
      overload: 0,
      staleTimer: 0,
      morningReview: 0,
      eveningReview: 0,
      weeklyReview: 0,
      waitingFollowup: 0,
      overdueDecision: 0,
      planningFeedback: 0,
      usersProcessed: 1,
      disabled: 0,
      notDue: 0,
      stale: 0,
      deduplicated: 0,
      noContent: 0,
      noSubscription: 0,
      attempted: 1,
      sent: 1,
      failed: 0,
      skipped: 0,
      errors: 0,
    });

    const response = await POST(
      new Request("http://localhost/api/cron/notifications", {
        method: "POST",
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      daily: 1,
      weekly: 0,
      deadline: 0,
      overload: 0,
      staleTimer: 0,
      morningReview: 0,
      eveningReview: 0,
      weeklyReview: 0,
      waitingFollowup: 0,
      overdueDecision: 0,
      planningFeedback: 0,
      usersProcessed: 1,
      disabled: 0,
      notDue: 0,
      stale: 0,
      deduplicated: 0,
      noContent: 0,
      noSubscription: 0,
      attempted: 1,
      sent: 1,
      failed: 0,
      skipped: 0,
      errors: 0,
    });
    expect(JSON.stringify(body)).not.toContain("user@");
    expect(mocks.processScheduledNotifications).toHaveBeenCalled();
  });
});
