import { createHash, randomBytes, timingSafeEqual } from "crypto";

const TOKEN_PREFIX = "los_";

export type GeneratedShortcutToken = {
  token: string;
  tokenHash: string;
  tokenPrefix: string;
};

export function generateShortcutToken(): GeneratedShortcutToken {
  const secret = randomBytes(32).toString("base64url");
  const token = `${TOKEN_PREFIX}${secret}`;
  return {
    token,
    tokenHash: hashShortcutToken(token),
    tokenPrefix: token.slice(0, 12),
  };
}

export function hashShortcutToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyShortcutToken(
  providedToken: string,
  storedHash: string,
): boolean {
  const providedHash = hashShortcutToken(providedToken);
  const a = Buffer.from(providedHash, "utf8");
  const b = Buffer.from(storedHash, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function redactAuthorizationHeader(
  headers: Headers | Record<string, string | undefined>,
): Record<string, string> {
  const result: Record<string, string> = {};
  const entries =
    headers instanceof Headers
      ? Array.from(headers.entries())
      : Object.entries(headers);

  for (const [key, value] of entries) {
    if (!value) continue;
    if (key.toLowerCase() === "authorization") {
      result[key] = "Bearer [REDACTED]";
    } else {
      result[key] = value;
    }
  }
  return result;
}
