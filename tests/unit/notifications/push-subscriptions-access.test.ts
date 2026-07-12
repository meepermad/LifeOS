import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listDeviceSummaries,
  listActiveSubscriptions,
  registerPushSubscription,
  deactivateById,
  deactivateByEndpoint,
} from "@/lib/notifications/subscriptions";

function createSessionClient() {
  const rpc = vi.fn();
  const from = vi.fn();

  return {
    client: { rpc, from } as never,
    rpc,
    from,
  };
}

describe("push subscription data exposure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists devices via RPC without direct table select", async () => {
    const { client, rpc, from } = createSessionClient();
    rpc.mockResolvedValue({
      data: [
        {
          id: "device-1",
          device_name: "Desktop browser",
          is_active: true,
          last_successful_push: null,
          last_failed_push: null,
          created_at: "2026-07-11T00:00:00Z",
        },
      ],
      error: null,
    });

    const devices = await listDeviceSummaries(client);

    expect(rpc).toHaveBeenCalledWith("list_push_device_summaries");
    expect(from).not.toHaveBeenCalled();
    expect(devices[0]).toEqual({
      id: "device-1",
      deviceName: "Desktop browser",
      isActive: true,
      lastSuccessfulPush: null,
      lastFailedPush: null,
      createdAt: "2026-07-11T00:00:00Z",
    });
    expect(devices[0]).not.toHaveProperty("endpoint");
    expect(devices[0]).not.toHaveProperty("p256dh");
    expect(devices[0]).not.toHaveProperty("auth");
  });

  it("registers subscriptions via RPC and returns safe summary only", async () => {
    const { client, rpc, from } = createSessionClient();
    rpc.mockResolvedValue({
      data: [
        {
          id: "device-2",
          device_name: "iPhone PWA",
          is_active: true,
          last_successful_push: null,
          last_failed_push: null,
          created_at: "2026-07-11T00:00:00Z",
        },
      ],
      error: null,
    });

    const summary = await registerPushSubscription(client, {
      endpoint: "https://push.example.com/secret",
      p256dh: "secret-p256dh",
      auth: "secret-auth",
      deviceName: "iPhone PWA",
    });

    expect(rpc).toHaveBeenCalledWith("register_push_subscription", {
      p_endpoint: "https://push.example.com/secret",
      p_p256dh: "secret-p256dh",
      p_auth: "secret-auth",
      p_device_name: "iPhone PWA",
      p_user_agent: undefined,
      p_content_encoding: undefined,
    });
    expect(from).not.toHaveBeenCalled();
    expect(summary.id).toBe("device-2");
    expect(summary).not.toHaveProperty("endpoint");
    expect(summary).not.toHaveProperty("p256dh");
    expect(summary).not.toHaveProperty("auth");
  });

  it("deactivates devices via RPC", async () => {
    const { client, rpc } = createSessionClient();
    rpc.mockResolvedValue({ data: true, error: null });

    await expect(deactivateById(client, "device-1")).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("deactivate_push_subscription", {
      p_subscription_id: "device-1",
    });

    rpc.mockResolvedValue({ data: true, error: null });
    await expect(
      deactivateByEndpoint(client, "https://push.example.com/x"),
    ).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith(
      "deactivate_push_subscription_by_endpoint",
      { p_endpoint: "https://push.example.com/x" },
    );
  });

  it("loads full subscription rows only on admin delivery path", async () => {
    const select = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() =>
          Promise.resolve({
            data: [
              {
                id: "sub-1",
                endpoint: "https://push.example.com/a",
                p256dh: "k1",
                auth: "a1",
              },
            ],
            error: null,
          }),
        ),
      })),
    }));
    const rpc = vi.fn();
    const from = vi.fn(() => ({ select }));
    const client = { from, rpc };

    const rows = await listActiveSubscriptions(client as never, "user-1");

    expect(from).toHaveBeenCalledWith("push_subscriptions");
    expect(select).toHaveBeenCalledWith("*");
    expect(rpc).not.toHaveBeenCalled();
    expect(rows[0]?.endpoint).toBe("https://push.example.com/a");
  });
});
