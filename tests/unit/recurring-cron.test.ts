import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getCronSecret: vi.fn(),
  getAllowedEmail: vi.fn(),
  findAllowedUserId: vi.fn(),
  materializeAllActiveTemplates: vi.fn(),
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

vi.mock("@/lib/data/recurrence", () => ({
  materializeAllActiveTemplates: mocks.materializeAllActiveTemplates,
}));

import { POST } from "@/app/api/cron/recurring-tasks/route";

describe("POST /api/cron/recurring-tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCronSecret.mockReturnValue("cron-secret");
    mocks.getAllowedEmail.mockReturnValue("user@example.com");
    mocks.createAdminClient.mockReturnValue({});
    mocks.findAllowedUserId.mockResolvedValue("user-1");
    mocks.materializeAllActiveTemplates.mockResolvedValue({
      generated: 2,
      skipped: 1,
      errors: 0,
    });
  });

  it("rejects missing cron secret", async () => {
    const response = await POST(
      new Request("http://localhost/api/cron/recurring-tasks", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.materializeAllActiveTemplates).not.toHaveBeenCalled();
  });

  it("rejects incorrect cron secret", async () => {
    const response = await POST(
      new Request("http://localhost/api/cron/recurring-tasks", {
        method: "POST",
        headers: { authorization: "Bearer wrong-secret" },
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.materializeAllActiveTemplates).not.toHaveBeenCalled();
  });

  it("returns materialization counts after valid cron secret", async () => {
    const response = await POST(
      new Request("http://localhost/api/cron/recurring-tasks", {
        method: "POST",
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      generated: 2,
      skipped: 1,
      errors: 0,
    });
    expect(mocks.materializeAllActiveTemplates).toHaveBeenCalledWith({
      client: {},
      userId: "user-1",
    });
  });
});
