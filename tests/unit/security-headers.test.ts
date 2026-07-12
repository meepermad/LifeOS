import { describe, expect, it } from "vitest";
import { SECURITY_HEADERS } from "@/lib/security/headers";

describe("security headers", () => {
  it("includes required production security headers", () => {
    const keys = SECURITY_HEADERS.map((header) => header.key);

    expect(keys).toContain("X-Content-Type-Options");
    expect(keys).toContain("Referrer-Policy");
    expect(keys).toContain("X-Frame-Options");
    expect(keys).toContain("Permissions-Policy");
    expect(keys).toContain("Content-Security-Policy");
  });

  it("uses a documented starter CSP compatible with Supabase and service workers", () => {
    const csp = SECURITY_HEADERS.find(
      (header) => header.key === "Content-Security-Policy",
    )?.value;

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("worker-src 'self'");
    expect(csp).toContain("connect-src 'self' https://*.supabase.co wss://*.supabase.co");
    expect(csp).not.toMatch(/default-src\s+'\*'/);
  });
});
