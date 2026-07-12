import { describe, expect, it } from "vitest";

import * as canvasCronRoute from "@/app/api/cron/canvas-sync/route";
import * as notificationsCronRoute from "@/app/api/cron/notifications/route";
import * as microsoftCronRoute from "@/app/api/cron/microsoft-sync/route";
import * as readinessRoute from "@/app/api/readiness/route";
import * as microsoftStartRoute from "@/app/api/auth/microsoft/start/route";
import * as microsoftCallbackRoute from "@/app/api/auth/microsoft/callback/route";

describe("Node runtime configuration", () => {
  it("declares nodejs runtime on cron routes", () => {
    expect(canvasCronRoute.runtime).toBe("nodejs");
    expect(notificationsCronRoute.runtime).toBe("nodejs");
    expect(microsoftCronRoute.runtime).toBe("nodejs");
    expect(readinessRoute.runtime).toBe("nodejs");
  });

  it("declares nodejs runtime on Microsoft OAuth routes", () => {
    expect(microsoftStartRoute.runtime).toBe("nodejs");
    expect(microsoftCallbackRoute.runtime).toBe("nodejs");
  });

  it("forces dynamic rendering on privileged routes", () => {
    expect(canvasCronRoute.dynamic).toBe("force-dynamic");
    expect(notificationsCronRoute.dynamic).toBe("force-dynamic");
    expect(microsoftCronRoute.dynamic).toBe("force-dynamic");
    expect(readinessRoute.dynamic).toBe("force-dynamic");
    expect(microsoftStartRoute.dynamic).toBe("force-dynamic");
    expect(microsoftCallbackRoute.dynamic).toBe("force-dynamic");
  });
});
