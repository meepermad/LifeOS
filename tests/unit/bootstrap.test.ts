import { describe, expect, it, vi, beforeEach } from "vitest";
import { DEFAULT_CALENDARS } from "@/lib/constants";

vi.mock("@/lib/auth/authorize-user", () => ({
  requireAllowedUser: vi.fn().mockResolvedValue({
    id: "user-1",
    email: "user@example.com",
  }),
}));

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

import { ensureUserInitialized } from "@/lib/data/bootstrap";

function createQueryChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "order", "insert", "update", "upsert"];

  for (const method of methods) {
    chain[method] = vi.fn(() => chain);
  }

  chain.single = vi.fn(() => Promise.resolve(result));
  chain.maybeSingle = vi.fn(() => Promise.resolve(result));
  return chain;
}

describe("ensureUserInitialized", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates required default calendars without duplication", async () => {
    const upsertCalls: unknown[] = [];

    mockFrom.mockImplementation((table: string) => {
      if (table === "planning_preferences") {
        return {
          upsert: vi.fn((payload, options) => {
            upsertCalls.push({ table, payload, options });
            return Promise.resolve({ error: null });
          }),
        };
      }

      if (table === "calendars") {
        const upsert = vi.fn((payload, options) => {
          upsertCalls.push({ table, payload, options });
          return Promise.resolve({ error: null });
        });

        return {
          upsert,
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() =>
                Promise.resolve({
                  data: DEFAULT_CALENDARS.map((calendar, index) => ({
                    id: `cal-${index}`,
                    user_id: "user-1",
                    connection_id: null,
                    external_calendar_id: null,
                    name: calendar.name,
                    source: calendar.source,
                    is_visible: calendar.is_visible,
                    is_writable: calendar.is_writable,
                    sync_enabled: calendar.sync_enabled,
                    created_at: "",
                    updated_at: "",
                  })),
                  error: null,
                }),
              ),
            })),
          })),
        };
      }

      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
              single: vi.fn(() =>
                Promise.resolve({
                  data: {
                    id: "user-1",
                    email: "user@example.com",
                    timezone: "America/Chicago",
                    week_starts_on: 0,
                    created_at: "",
                    updated_at: "",
                  },
                  error: null,
                }),
              ),
            })),
          })),
          insert: vi.fn(() => Promise.resolve({ error: null })),
        };
      }

      return createQueryChain({ data: null, error: null });
    });

    const result = await ensureUserInitialized();

    expect(result.profile.email).toBe("user@example.com");
    expect(result.calendars).toHaveLength(DEFAULT_CALENDARS.length);
    expect(
      upsertCalls.filter((call) => (call as { table: string }).table === "calendars"),
    ).toHaveLength(DEFAULT_CALENDARS.length);
  });
});
