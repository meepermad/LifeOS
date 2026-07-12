import {
  AuthenticationError,
  AuthorizationError,
  DatabaseError,
  ValidationError,
  type AppError,
} from "@/lib/errors/app-error";

export type SafePostgrestError = {
  code?: string | null;
  message?: string | null;
  hint?: string | null;
};

function sanitizeDatabaseMessage(message: string): string {
  return message
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/Bearer\s+\S+/gi, "[token]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt]")
    .trim()
    .slice(0, 160);
}

export function mapPushSubscriptionRpcError(
  error: SafePostgrestError | null,
): AppError {
  if (!error) {
    return new DatabaseError("LifeOS could not save this device subscription.");
  }

  const code = error.code?.trim() || "UNKNOWN";
  const message = sanitizeDatabaseMessage(error.message?.trim() || "");

  if (code === "PGRST301" || /jwt expired|invalid jwt/i.test(message)) {
    return new AuthenticationError(
      "Your authentication session expired. Sign in again.",
    );
  }

  if (code === "42501") {
    if (/not authenticated/i.test(message)) {
      return new AuthenticationError(
        "Your authentication session expired. Sign in again.",
      );
    }
    if (/another account/i.test(message)) {
      return new AuthorizationError(
        "LifeOS could not save this device subscription.",
      );
    }
    if (/permission denied/i.test(message)) {
      return new DatabaseError("LifeOS could not save this device subscription.");
    }
    return new AuthorizationError(
      "LifeOS could not save this device subscription.",
    );
  }

  if (code === "22023" || code === "23514") {
    return new ValidationError("LifeOS could not save this device subscription.");
  }

  if (code === "23505") {
    return new AuthorizationError(
      "LifeOS could not save this device subscription.",
    );
  }

  return new DatabaseError(
    `LifeOS could not save this device subscription. (${code})`,
  );
}

export function logPushSubscriptionPersistenceError(
  error: SafePostgrestError | null,
  httpStatus?: number,
): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const message = error?.message
    ? sanitizeDatabaseMessage(error.message)
    : "unknown error";
  const hint = error?.hint ? sanitizeDatabaseMessage(error.hint) : null;

  console.error(
    `Push subscription persistence failed stage=persist code=${error?.code ?? "unknown"} status=${httpStatus ?? "n/a"} message=${message}${hint ? ` hint=${hint}` : ""}`,
  );
}

export function appErrorToHttpStatus(error: AppError): number {
  return error.statusCode;
}
