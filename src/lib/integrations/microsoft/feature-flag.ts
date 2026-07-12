import { AppError } from "@/lib/errors/app-error";

export class MicrosoftIntegrationDisabledError extends AppError {
  constructor() {
    super(
      "MICROSOFT_INTEGRATION_DISABLED",
      "Microsoft 365 integration is not enabled.",
      404,
    );
    this.name = "MicrosoftIntegrationDisabledError";
  }
}

export function isMicrosoftIntegrationEnabled(
  rawValue: string | undefined = process.env.MICROSOFT_INTEGRATION_ENABLED,
): boolean {
  if (!rawValue?.trim()) {
    return false;
  }

  const normalized = rawValue.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

export function assertMicrosoftIntegrationEnabled(): void {
  if (!isMicrosoftIntegrationEnabled()) {
    throw new MicrosoftIntegrationDisabledError();
  }
}
