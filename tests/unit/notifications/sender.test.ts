import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendNotificationToUser } from "@/lib/notifications/sender";
import type { PushSubscriptionRow } from "@/types/domain";

const mockSend = vi.fn();
const mockSetVapid = vi.fn();

vi.mock("@/lib/notifications/vapid", () => ({
  configureWebPush: vi.fn(),
  webpush: {
    sendNotification: (...args: unknown[]) => mockSend(...args),
    setVapidDetails: (...args: unknown[]) => mockSetVapid(...args),
  },
}));

function createMockClient(subscriptions: PushSubscriptionRow[]) {
  const deliveryRow = { id: "delivery-1", deduplication_key: "key", status: "pending" };

  return {
    from: vi.fn((table: string) => {
      if (table === "push_subscriptions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ data: subscriptions, error: null })),
              single: vi.fn(() =>
                Promise.resolve({ data: { failure_count: 0 }, error: null }),
              ),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        };
      }
      if (table === "notification_deliveries") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({ data: deliveryRow, error: null }),
              ),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
            })),
          })),
        };
      }
      return {};
    }),
  };
}

const sub1: PushSubscriptionRow = {
  id: "s1",
  user_id: "u1",
  endpoint: "https://push.example.com/a",
  p256dh: "k1",
  auth: "a1",
  device_name: null,
  user_agent: null,
  content_encoding: null,
  is_active: true,
  last_successful_push: null,
  last_failed_push: null,
  failure_count: 0,
  created_at: "",
  updated_at: "",
};

const sub2: PushSubscriptionRow = {
  ...sub1,
  id: "s2",
  endpoint: "https://push.example.com/b",
  p256dh: "k2",
  auth: "a2",
};

describe("sendNotificationToUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("continues when one device fails", async () => {
    mockSend
      .mockRejectedValueOnce({ statusCode: 500, message: "temporary" })
      .mockResolvedValueOnce(undefined);

    const client = createMockClient([sub1, sub2]);
    const result = await sendNotificationToUser(client as never, {
      userId: "u1",
      notificationType: "test",
      payload: {
        title: "Test",
        body: "Body",
        url: "/settings",
      },
      deduplicationKey: "test:u1:1",
      scheduledFor: new Date().toISOString(),
    });

    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("marks 410 subscriptions as invalid", async () => {
    mockSend.mockRejectedValue({ statusCode: 410 });

    const client = createMockClient([sub1]);
    const result = await sendNotificationToUser(client as never, {
      userId: "u1",
      notificationType: "test",
      payload: {
        title: "Test",
        body: "Body",
        url: "/settings",
      },
      deduplicationKey: "test:u1:2",
      scheduledFor: new Date().toISOString(),
    });

    expect(result.invalidCount).toBe(1);
    expect(result.successCount).toBe(0);
  });

  it("does not expose raw endpoint in return value", async () => {
    mockSend.mockResolvedValue(undefined);
    const client = createMockClient([sub1]);
    const result = await sendNotificationToUser(client as never, {
      userId: "u1",
      notificationType: "test",
      payload: {
        title: "Test",
        body: "Body",
        url: "/settings",
      },
      deduplicationKey: "test:u1:3",
      scheduledFor: new Date().toISOString(),
    });

    expect(JSON.stringify(result)).not.toContain("push.example.com");
    expect(JSON.stringify(result)).not.toContain("k1");
  });
});
