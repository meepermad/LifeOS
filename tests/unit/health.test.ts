import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("returns only safe liveness information", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok", service: "lifeos" });
    expect(Object.keys(body).sort()).toEqual(["service", "status"]);
    expect(JSON.stringify(body)).not.toContain("@");
    expect(JSON.stringify(body)).not.toContain("supabase");
  });
});
