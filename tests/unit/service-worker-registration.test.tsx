import { afterEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { ServiceWorkerRegistration } from "@/components/notifications/service-worker-registration";

describe("ServiceWorkerRegistration", () => {
  const register = vi.fn().mockResolvedValue({});

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers /sw.js when service workers are available", async () => {
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    render(<ServiceWorkerRegistration />);

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith("/sw.js");
    });
  });
});
