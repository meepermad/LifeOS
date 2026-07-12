import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  authenticateShortcutDevice,
  getShortcutDedupResponse,
  recordShortcutDeviceUsage,
  storeShortcutDedupResponse,
} from "@/lib/shortcuts/auth";
import { processShortcutCommand } from "@/lib/shortcuts/command-processor";
import {
  checkFailedAuthRateLimit,
  checkShortcutDeviceRateLimit,
  checkShortcutIpRateLimit,
} from "@/lib/shortcuts/rate-limit";
import { shortcutCommandRequestSchema } from "@/lib/shortcuts/schemas";
import { redactAuthorizationHeader } from "@/lib/shortcuts/tokens";

export const runtime = "nodejs";

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function errorResponse(
  code: string,
  spokenText: string,
  displayText: string,
  status = 200,
) {
  return NextResponse.json(
    {
      status: "error",
      code,
      spokenText,
      displayText,
      openUrl: null,
    },
    { status },
  );
}

function extractBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  if (process.env.NODE_ENV === "production") {
    const proto = request.headers.get("x-forwarded-proto");
    if (proto && proto !== "https") {
      return errorResponse(
        "SHORTCUT_INTERNAL_ERROR",
        "Secure connection required.",
        "Secure connection required.",
        400,
      );
    }
  }

  const token = extractBearerToken(request);
  if (!token) {
    if (!checkFailedAuthRateLimit(ip)) {
      return errorResponse(
        "SHORTCUT_RATE_LIMITED",
        "Too many requests. Try again later.",
        "Rate limited.",
        429,
      );
    }
    console.error("Shortcut auth failed", redactAuthorizationHeader(request.headers));
    return errorResponse(
      "SHORTCUT_TOKEN_INVALID",
      "That shortcut token is not valid.",
      "Invalid shortcut token.",
      401,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(
      "SHORTCUT_INTERNAL_ERROR",
      "The request was not valid JSON.",
      "Invalid request.",
      400,
    );
  }

  let parsed;
  try {
    parsed = shortcutCommandRequestSchema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      const tooLong = error.issues.some((issue) =>
        issue.path.includes("command") && issue.code === "too_big",
      );
      return errorResponse(
        tooLong ? "COMMAND_TOO_LONG" : "COMMAND_EMPTY",
        tooLong ? "That command is too long." : "Please provide a command.",
        tooLong ? "Command too long." : "Command empty.",
        400,
      );
    }
    return errorResponse(
      "SHORTCUT_INTERNAL_ERROR",
      "The request was invalid.",
      "Invalid request.",
      400,
    );
  }

  const device = await authenticateShortcutDevice(token);
  if (!device) {
    if (!checkFailedAuthRateLimit(ip)) {
      return errorResponse(
        "SHORTCUT_RATE_LIMITED",
        "Too many requests. Try again later.",
        "Rate limited.",
        429,
      );
    }
    console.error("Shortcut auth failed", redactAuthorizationHeader(request.headers));
    return errorResponse(
      "SHORTCUT_TOKEN_INVALID",
      "That shortcut token is not valid.",
      "Invalid shortcut token.",
      401,
    );
  }

  if (!checkShortcutIpRateLimit(ip) || !checkShortcutDeviceRateLimit(device.id)) {
    await recordShortcutDeviceUsage(device.id, false, "SHORTCUT_RATE_LIMITED");
    return errorResponse(
      "SHORTCUT_RATE_LIMITED",
      "Too many requests. Try again later.",
      "Rate limited.",
      429,
    );
  }

  const cached = await getShortcutDedupResponse(
    device.id,
    parsed.clientRequestId,
  );
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const response = await processShortcutCommand({
      device,
      command: parsed.command,
      timezone: parsed.timezone,
    });

    await storeShortcutDedupResponse(
      device.id,
      parsed.clientRequestId,
      response,
    );
    await recordShortcutDeviceUsage(
      device.id,
      response.status !== "error",
      response.code,
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error(
      "Shortcut command failed",
      error instanceof Error ? error.name : "unknown",
    );
    await recordShortcutDeviceUsage(
      device.id,
      false,
      "SHORTCUT_INTERNAL_ERROR",
    );
    return errorResponse(
      "SHORTCUT_INTERNAL_ERROR",
      "Something went wrong while processing your command.",
      "Internal error.",
      500,
    );
  }
}
