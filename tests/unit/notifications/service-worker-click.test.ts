import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

type FakeClient = {
  url: string;
  focused: boolean;
  visibilityState: "visible" | "hidden";
  navigate: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
  postMessage: ReturnType<typeof vi.fn>;
};

function loadSwHandlers() {
  const destScript = readFileSync(
    resolve(process.cwd(), "public/lifeos-notification-destinations.js"),
    "utf8",
  );
  const swScript = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");

  const listeners: Record<string, Array<(event: unknown) => void>> = {};
  const clientsList: FakeClient[] = [];
  const openWindow = vi.fn(async (url: string) => ({ url }));
  const showNotification = vi.fn(async () => undefined);

  const selfObj: Record<string, unknown> = {
    location: { origin: "https://lifeos.example" },
    clients: {
      matchAll: vi.fn(async () => clientsList),
      openWindow,
    },
    registration: { showNotification },
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      listeners[type] = listeners[type] ?? [];
      listeners[type].push(handler);
    },
    skipWaiting: vi.fn(),
  };

  // eslint-disable-next-line no-new-func -- evaluate SW script in harness
  new Function("self", "importScripts", destScript + "\n" + swScript.replace(
    /importScripts\("\/lifeos-notification-destinations\.js"\);\s*/,
    "",
  ))(selfObj, () => undefined);

  return {
    listeners,
    clientsList,
    openWindow,
    showNotification,
    selfObj,
  };
}

describe("service worker notificationclick", () => {
  let harness: ReturnType<typeof loadSwHandlers>;

  beforeEach(() => {
    harness = loadSwHandlers();
  });

  function fireClick(data: Record<string, unknown>) {
    const waitUntil = vi.fn((p: Promise<unknown>) => p);
    const close = vi.fn();
    const handler = harness.listeners.notificationclick?.[0];
    expect(handler).toBeDefined();
    handler!({
      notification: { data, close },
      waitUntil,
    });
    return { waitUntil, close };
  }

  it("reuses an existing visible client", async () => {
    const client: FakeClient = {
      url: "https://lifeos.example/tasks",
      focused: false,
      visibilityState: "visible",
      navigate: vi.fn(async () => client),
      focus: vi.fn(async () => client),
      postMessage: vi.fn(),
    };
    harness.clientsList.push(client);

    const { waitUntil, close } = fireClick({
      version: 1,
      destination: { kind: "daily_review", period: "morning" },
      url: "/review/daily?period=morning",
    });

    expect(close).toHaveBeenCalled();
    await waitUntil.mock.calls[0][0];
    expect(client.navigate).toHaveBeenCalledWith(
      "https://lifeos.example/review/daily?period=morning",
    );
    expect(client.focus).toHaveBeenCalled();
    expect(harness.openWindow).not.toHaveBeenCalled();
  });

  it("reuses a hidden client", async () => {
    const client: FakeClient = {
      url: "https://lifeos.example/today",
      focused: false,
      visibilityState: "hidden",
      navigate: vi.fn(async () => client),
      focus: vi.fn(async () => client),
      postMessage: vi.fn(),
    };
    harness.clientsList.push(client);

    const { waitUntil } = fireClick({
      destination: { kind: "notification_settings" },
    });
    await waitUntil.mock.calls[0][0];
    expect(client.navigate).toHaveBeenCalled();
    expect(harness.openWindow).not.toHaveBeenCalled();
  });

  it("opens a window when no client exists", async () => {
    const { waitUntil } = fireClick({
      destination: { kind: "today" },
    });
    await waitUntil.mock.calls[0][0];
    expect(harness.openWindow).toHaveBeenCalledWith(
      "https://lifeos.example/today",
    );
  });

  it("falls back to openWindow when navigate fails", async () => {
    const client: FakeClient = {
      url: "https://lifeos.example/today",
      focused: true,
      visibilityState: "visible",
      navigate: vi.fn(async () => {
        throw new Error("navigate failed");
      }),
      focus: vi.fn(async () => client),
      postMessage: vi.fn(),
    };
    harness.clientsList.push(client);

    const { waitUntil } = fireClick({
      destination: { kind: "weekly_review", step: "capacity" },
    });
    await waitUntil.mock.calls[0][0];
    expect(client.postMessage).toHaveBeenCalledWith({
      type: "LIFEOS_NOTIFICATION_NAVIGATE",
      path: "/review/weekly?step=capacity",
    });
    expect(harness.openWindow).toHaveBeenCalled();
  });

  it("handles legacy payloads without throwing", async () => {
    const { waitUntil } = fireClick({ url: "/settings" });
    await waitUntil.mock.calls[0][0];
    expect(harness.openWindow).toHaveBeenCalledWith(
      "https://lifeos.example/settings/notifications",
    );
  });

  it("handles unknown payloads safely", async () => {
    const { waitUntil } = fireClick({ url: "https://evil.example" });
    await waitUntil.mock.calls[0][0];
    expect(harness.openWindow).toHaveBeenCalledWith(
      "https://lifeos.example/today",
    );
  });

  it("does not navigate other-origin clients", async () => {
    const foreign: FakeClient = {
      url: "https://evil.example/",
      focused: true,
      visibilityState: "visible",
      navigate: vi.fn(async () => foreign),
      focus: vi.fn(async () => foreign),
      postMessage: vi.fn(),
    };
    harness.clientsList.push(foreign);

    const { waitUntil } = fireClick({ destination: { kind: "today" } });
    await waitUntil.mock.calls[0][0];
    expect(foreign.navigate).not.toHaveBeenCalled();
    expect(harness.openWindow).toHaveBeenCalledWith(
      "https://lifeos.example/today",
    );
  });
});
