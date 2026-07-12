import { timingSafeEqual } from "crypto";

export function verifyCronSecret(
  authorizationHeader: string | null,
  expectedSecret: string,
): boolean {
  if (!authorizationHeader) return false;

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return false;

  const provided = match[1];
  if (provided.length !== expectedSecret.length) return false;

  try {
    return timingSafeEqual(
      Buffer.from(provided, "utf8"),
      Buffer.from(expectedSecret, "utf8"),
    );
  } catch {
    return false;
  }
}
