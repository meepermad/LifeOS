import { AppError } from "@/lib/errors/app-error";

export class AiIntentRouterDisabledError extends AppError {
  constructor() {
    super(
      "AI_INTENT_ROUTER_DISABLED",
      "Assistant language fallback is not enabled.",
      404,
    );
    this.name = "AiIntentRouterDisabledError";
  }
}

export function isAiIntentRouterEnabled(
  rawValue: string | undefined = process.env.AI_INTENT_ROUTER_ENABLED,
): boolean {
  if (!rawValue?.trim()) {
    return false;
  }

  const normalized = rawValue.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

export function assertAiIntentRouterEnabled(): void {
  if (!isAiIntentRouterEnabled()) {
    throw new AiIntentRouterDisabledError();
  }
}
