import { describe, expect, it, vi } from "vitest";
import {
  PUSH_ENABLE_STAGES,
  resolveNotificationPermission,
  runPushEnableBrowserFlow,
} from "@/lib/notifications/push-enable-flow";
import { VapidKeyError } from "@/lib/notifications/vapid-client";

const validKeyBytes = new Uint8Array(65).fill(7);
validKeyBytes[0] = 4;

function namedError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

function createRegistration(options?: {
  getSubscription?: ReturnType<typeof vi.fn>;
  subscribe?: ReturnType<typeof vi.fn>;
}) {
  const getSubscription =
    options?.getSubscription ?? vi.fn().mockResolvedValue(null);
  const subscribe = options?.subscribe ?? vi.fn();

  return {
    registration: {
      pushManager: {
        getSubscription,
        subscribe,
      },
    } as unknown as ServiceWorkerRegistration,
    getSubscription,
    subscribe,
  };
}

function asServiceWorkerContainer(
  registration: ServiceWorkerRegistration,
): ServiceWorkerContainer {
  return {
    ready: Promise.resolve(registration),
  } as unknown as ServiceWorkerContainer;
}

describe("push enable browser flow", () => {
  it("does not request permission when already granted", async () => {
    const requestPermission = vi.fn();
    const notification = {
      permission: "granted" as NotificationPermission,
      requestPermission,
    };

    const permission = await resolveNotificationPermission(notification);

    expect(permission).toBe("granted");
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("reuses an existing browser subscription without calling subscribe", async () => {
    const { registration, subscribe } = createRegistration({
      getSubscription: vi.fn().mockResolvedValue({
        toJSON: () => ({
          endpoint: "https://push.example.com/device",
          keys: { p256dh: "p".repeat(80), auth: "a".repeat(40) },
        }),
      }),
    });

    const result = await runPushEnableBrowserFlow(
      {
        supported: true,
        vapidPublicKey: "valid-key",
        serviceWorker: asServiceWorkerContainer(registration),
        notification: {
          permission: "granted",
          requestPermission: vi.fn(),
        },
      },
      () => validKeyBytes,
    );

    expect(result.ok).toBe(true);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("reports service worker unavailable", async () => {
    const result = await runPushEnableBrowserFlow(
      {
        supported: true,
        vapidPublicKey: "valid-key",
        notification: {
          permission: "granted",
          requestPermission: vi.fn(),
        },
      },
      () => validKeyBytes,
    );

    expect(result).toEqual({
      ok: false,
      stage: PUSH_ENABLE_STAGES.SERVICE_WORKER,
      message: "Service workers are not available.",
    });
  });

  it("reports service worker not ready failures", async () => {
    const result = await runPushEnableBrowserFlow(
      {
        supported: true,
        vapidPublicKey: "valid-key",
        serviceWorker: {
          ready: Promise.reject(namedError("AbortError", "aborted")),
        } as unknown as ServiceWorkerContainer,
        notification: {
          permission: "granted",
          requestPermission: vi.fn(),
        },
      },
      () => validKeyBytes,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe(PUSH_ENABLE_STAGES.SERVICE_WORKER);
      expect(result.errorName).toBe("AbortError");
      expect(result.message).toBe("Service worker is not ready.");
    }
  });

  it("reports malformed VAPID public keys", async () => {
    const { registration } = createRegistration();

    const result = await runPushEnableBrowserFlow(
      {
        supported: true,
        vapidPublicKey: "valid-key",
        serviceWorker: asServiceWorkerContainer(registration),
        notification: {
          permission: "granted",
          requestPermission: vi.fn(),
        },
      },
      () => {
        throw new VapidKeyError("malformed");
      },
    );

    expect(result).toEqual({
      ok: false,
      stage: PUSH_ENABLE_STAGES.VAPID_DECODE,
      errorName: "VapidKeyError",
      message: "The VAPID public key is invalid.",
    });
  });

  it("maps InvalidAccessError to a browser rejection message", async () => {
    const { registration } = createRegistration({
      subscribe: vi
        .fn()
        .mockRejectedValue(
          namedError("InvalidAccessError", "applicationServerKey invalid"),
        ),
    });

    const result = await runPushEnableBrowserFlow(
      {
        supported: true,
        vapidPublicKey: "valid-key",
        serviceWorker: asServiceWorkerContainer(registration),
        notification: {
          permission: "granted",
          requestPermission: vi.fn(),
        },
      },
      () => validKeyBytes,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe(PUSH_ENABLE_STAGES.SUBSCRIBE);
      expect(result.errorName).toBe("InvalidAccessError");
      expect(result.message).toBe(
        "Push subscription was rejected by the browser.",
      );
    }
  });

  it("maps NotAllowedError to a permission failure", async () => {
    const result = await runPushEnableBrowserFlow(
      {
        supported: true,
        vapidPublicKey: "valid-key",
        serviceWorker: asServiceWorkerContainer(createRegistration().registration),
        notification: {
          permission: "default",
          requestPermission: vi
            .fn()
            .mockRejectedValue(namedError("NotAllowedError", "denied")),
        },
      },
      () => validKeyBytes,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe(PUSH_ENABLE_STAGES.PERMISSION);
      expect(result.errorName).toBe("NotAllowedError");
    }
  });
});
