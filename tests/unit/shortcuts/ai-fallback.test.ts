import { describe, expect, it, vi, beforeEach } from "vitest";
import { processShortcutCommand } from "@/lib/shortcuts/command-processor";

vi.mock("@/lib/assistant/build-parse-options", () => ({
  buildParseOptionsForUser: vi.fn(async () => ({
    timezone: "America/Chicago",
    academicContext: { terms: [], exceptions: [], timezone: "America/Chicago" },
  })),
}));

vi.mock("@/lib/assistant/ai-intent-router/router", () => ({
  tryAiIntentRouter: vi.fn(),
}));

vi.mock("@/lib/assistant/executor", () => ({
  executeReadOnly: vi.fn(async () => ({
    content: "Next class tomorrow.",
    messageType: "text",
    structuredPayload: {},
  })),
  buildWritePreview: vi.fn(async () => ({
    content: "Preview",
    messageType: "action_preview",
    structuredPayload: {},
    actionPreview: { actionType: "create_task", proposedPayload: { title: "x" } },
  })),
  isReadOnlyIntent: vi.fn((cmd) => cmd.intent === "show_next_class"),
  isWriteIntent: vi.fn((cmd) => cmd.intent === "create_task"),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async () =>
                  table === "assistant_threads"
                    ? { data: { id: "thread-1" } }
                    : { data: null },
              }),
            }),
          }),
          order: () => ({
            limit: () => ({
              maybeSingle: async () => ({ data: null }),
            }),
          }),
          single: async () => ({ data: { id: "row-1" }, error: null }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: async () => ({ data: { id: "row-1" }, error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/security/env", () => ({
  getServerEnv: () => ({ NEXT_PUBLIC_APP_URL: "http://localhost:3000" }),
}));

import { tryAiIntentRouter } from "@/lib/assistant/ai-intent-router/router";

const device = {
  id: "device-1",
  userId: "user-1",
  name: "Phone",
  spokenDetailLevel: "private" as const,
};

describe("shortcut ai fallback", () => {
  beforeEach(() => {
    vi.mocked(tryAiIntentRouter).mockReset();
  });

  it("uses AI for unknown commands", async () => {
    vi.mocked(tryAiIntentRouter).mockResolvedValue({
      attempted: true,
      parseResult: {
        kind: "command",
        command: { intent: "show_next_class" },
      },
    });

    const response = await processShortcutCommand({
      device,
      command: "when is my next lecture thing",
    });

    expect(tryAiIntentRouter).toHaveBeenCalled();
    expect(response.status).toBe("completed");
  });

  it("returns review_required for write intents", async () => {
    vi.mocked(tryAiIntentRouter).mockResolvedValue({
      attempted: true,
      parseResult: {
        kind: "command",
        command: { intent: "create_task", title: "Study" },
      },
    });

    const response = await processShortcutCommand({
      device,
      command: "remind me to study",
    });

    expect(response.status).toBe("review_required");
    expect(response.openUrl).toContain("/chat?action=");
  });
});
