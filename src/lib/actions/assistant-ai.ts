"use server";

import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { buildParseOptions } from "@/lib/actions/assistant-parse-options";
import {
  getAiIntentRouterStatus,
  testAiIntentRouterClassification,
} from "@/lib/assistant/ai-intent-router/router";
import type { ActionResult } from "@/lib/actions/assistant";

export type AiIntentRouterStatusResult = {
  enabled: boolean;
  provider: string | null;
  dailyCap: number;
  requestsUsedToday: number;
  lastSafeError: string | null;
};

export type AiIntentRouterTestResult = {
  status: "matched" | "clarification" | "unsupported" | "unavailable";
  intent: string | null;
};

export async function getAiIntentRouterStatusAction(): Promise<
  ActionResult<AiIntentRouterStatusResult>
> {
  try {
    const user = await requireAllowedUser();
    const status = await getAiIntentRouterStatus(user.id);
    return { success: true, data: status };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load status",
    };
  }
}

export async function testAiIntentRouterAction(
  phrase: string,
): Promise<ActionResult<AiIntentRouterTestResult>> {
  try {
    const user = await requireAllowedUser();
    const parseOptions = await buildParseOptions();
    const result = await testAiIntentRouterClassification({
      message: phrase,
      userId: user.id,
      parseOptions,
    });
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Test classification failed",
    };
  }
}
