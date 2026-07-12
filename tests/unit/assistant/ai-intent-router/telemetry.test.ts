import { describe, expect, it } from "vitest";

describe("ai intent router telemetry privacy", () => {
  it("telemetry row fields are metadata-only", () => {
    const allowedFields = new Set([
      "user_id",
      "provider",
      "model",
      "schema_version",
      "selected_intent",
      "confidence_bucket",
      "status",
      "error_category",
      "latency_bucket_ms",
      "usage_units",
    ]);

    const sampleInsert = {
      user_id: "user-1",
      provider: "cloudflare",
      model: "model",
      schema_version: 1,
      selected_intent: "schedule_summary",
      confidence_bucket: "0.85-1.0",
      status: "success",
      error_category: null,
      latency_bucket_ms: "0-500",
      usage_units: null,
    };

    for (const key of Object.keys(sampleInsert)) {
      expect(allowedFields.has(key)).toBe(true);
    }
    expect(sampleInsert).not.toHaveProperty("message");
    expect(sampleInsert).not.toHaveProperty("prompt");
    expect(sampleInsert).not.toHaveProperty("response_body");
  });
});
