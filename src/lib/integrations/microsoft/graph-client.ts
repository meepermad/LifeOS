import { z } from "zod";
import { AppError, ValidationError } from "@/lib/errors/app-error";
import {
  GRAPH_MAX_PAGES,
  GRAPH_MAX_RESPONSE_BYTES,
  GRAPH_MAX_RETRIES,
  GRAPH_PREFER_HEADERS,
  GRAPH_REQUEST_TIMEOUT_MS,
  MICROSOFT_GRAPH_BASE,
} from "@/lib/integrations/microsoft/config";
import {
  graphCalendarListSchema,
  graphEventListSchema,
  type GraphCalendar,
  type GraphEvent,
} from "@/lib/integrations/microsoft/schemas";

export class GraphApiError extends AppError {
  readonly retryAfterSeconds: number | null;
  readonly requiresDeltaReset: boolean;
  readonly requiresReauthentication: boolean;
  readonly isConsentBlocked: boolean;

  constructor(
    message: string,
    options: {
      statusCode: number;
      retryAfterSeconds?: number | null;
      requiresDeltaReset?: boolean;
      requiresReauthentication?: boolean;
      isConsentBlocked?: boolean;
    },
  ) {
    super("GRAPH_API_ERROR", message, options.statusCode || 502);
    this.name = "GraphApiError";
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
    this.requiresDeltaReset = options.requiresDeltaReset ?? false;
    this.requiresReauthentication = options.requiresReauthentication ?? false;
    this.isConsentBlocked = options.isConsentBlocked ?? false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) {
    return null;
  }

  const seconds = Number.parseInt(header, 10);
  if (!Number.isNaN(seconds)) {
    return seconds;
  }

  const dateMs = Date.parse(header);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, Math.ceil((dateMs - Date.now()) / 1000));
  }

  return null;
}

function toSafeGraphError(status: number, bodyText: string): GraphApiError {
  if (status === 401) {
    return new GraphApiError("Microsoft credentials expired. Reconnect your account.", {
      statusCode: status,
      requiresReauthentication: true,
    });
  }

  if (status === 403) {
    const consentBlocked =
      bodyText.includes("consent") ||
      bodyText.includes("Authorization_RequestDenied") ||
      bodyText.includes("insufficient");
    return new GraphApiError(
      consentBlocked
        ? "Your organization has not granted calendar read access to LifeOS."
        : "Microsoft denied access to calendar data.",
      {
        statusCode: status,
        isConsentBlocked: consentBlocked,
        requiresReauthentication: consentBlocked,
      },
    );
  }

  if (status === 404) {
    return new GraphApiError("Microsoft calendar was not found.", {
      statusCode: status,
    });
  }

  if (status === 410) {
    return new GraphApiError("Microsoft delta sync expired and must be reset.", {
      statusCode: status,
      requiresDeltaReset: true,
    });
  }

  if (status === 429) {
    return new GraphApiError("Microsoft Graph rate limit reached.", {
      statusCode: status,
    });
  }

  if (status >= 500) {
    return new GraphApiError("Microsoft Graph is temporarily unavailable.", {
      statusCode: status,
    });
  }

  return new GraphApiError("Microsoft Graph request failed.", {
    statusCode: status,
  });
}

async function readLimitedResponse(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    return "";
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    total += value.byteLength;
    if (total > GRAPH_MAX_RESPONSE_BYTES) {
      throw new ValidationError("Microsoft Graph response was too large.");
    }

    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(merged);
}

export async function graphRequest<T>(
  accessToken: string,
  url: string,
  options: { method?: "GET"; validate?: (json: unknown) => T } = {},
): Promise<T> {
  let attempt = 0;

  while (attempt <= GRAPH_MAX_RETRIES) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GRAPH_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: options.method ?? "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          Prefer: `${GRAPH_PREFER_HEADERS.timezone}, ${GRAPH_PREFER_HEADERS.immutableId}`,
        },
        signal: controller.signal,
      });

      const bodyText = await readLimitedResponse(response);

      if (response.ok) {
        let json: unknown;
        try {
          json = JSON.parse(bodyText);
        } catch {
          throw new ValidationError("Microsoft Graph returned invalid JSON.");
        }

        if (options.validate) {
          return options.validate(json);
        }

        return json as T;
      }

      const retryAfter = parseRetryAfter(response.headers.get("Retry-After"));
      let error = toSafeGraphError(response.status, bodyText);

      const shouldRetry =
        (response.status === 429 || response.status >= 500) &&
        attempt < GRAPH_MAX_RETRIES;

      if (!shouldRetry) {
        if (retryAfter !== null) {
          error = new GraphApiError(error.message, {
            statusCode: error.statusCode,
            retryAfterSeconds: retryAfter,
            requiresDeltaReset: error.requiresDeltaReset,
            requiresReauthentication: error.requiresReauthentication,
            isConsentBlocked: error.isConsentBlocked,
          });
        }
        throw error;
      }

      const waitSeconds = retryAfter ?? Math.min(2 ** attempt, 30);
      await sleep(waitSeconds * 1000);
      attempt += 1;
      continue;
    } catch (error) {
      if (error instanceof GraphApiError || error instanceof ValidationError) {
        throw error;
      }

      if (attempt >= GRAPH_MAX_RETRIES) {
        throw new GraphApiError("Microsoft Graph request timed out.", {
          statusCode: 0,
        });
      }

      await sleep(Math.min(2 ** attempt, 30) * 1000);
      attempt += 1;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new GraphApiError("Microsoft Graph request failed after retries.", {
    statusCode: 0,
  });
}

export async function listGraphCalendars(accessToken: string): Promise<GraphCalendar[]> {
  const calendars: GraphCalendar[] = [];
  let nextUrl: string | null = `${MICROSOFT_GRAPH_BASE}/me/calendars?$top=50`;
  let pages = 0;

  while (nextUrl) {
    pages += 1;
    if (pages > GRAPH_MAX_PAGES) {
      throw new ValidationError("Microsoft calendar discovery exceeded pagination limits.");
    }

    const page: z.infer<typeof graphCalendarListSchema> = await graphRequest(
      accessToken,
      nextUrl,
      {
        validate: (json) => graphCalendarListSchema.parse(json),
      },
    );

    calendars.push(...page.value);
    nextUrl = page["@odata.nextLink"] ?? null;
  }

  return calendars;
}

export type GraphDeltaPage = {
  events: GraphEvent[];
  nextLink: string | null;
  deltaLink: string | null;
};

export async function fetchGraphDeltaPage(
  accessToken: string,
  url: string,
): Promise<GraphDeltaPage> {
  const page = await graphRequest(accessToken, url, {
    validate: (json) => graphEventListSchema.parse(json),
  });

  return {
    events: page.value,
    nextLink: page["@odata.nextLink"] ?? null,
    deltaLink: page["@odata.deltaLink"] ?? null,
  };
}

export function buildInitialDeltaUrl(
  externalCalendarId: string,
  windowStart: string,
  windowEnd: string,
): string {
  const params = new URLSearchParams({
    startDateTime: windowStart,
    endDateTime: windowEnd,
    $top: "100",
  });

  return `${MICROSOFT_GRAPH_BASE}/me/calendars/${encodeURIComponent(externalCalendarId)}/calendarView/delta?${params.toString()}`;
}

export type GraphDeltaSyncResult = {
  events: GraphEvent[];
  deltaLink: string | null;
  warnings: number;
};

export async function syncGraphCalendarDelta(input: {
  accessToken: string;
  externalCalendarId: string;
  deltaUrl: string | null;
  windowStart: string;
  windowEnd: string;
  maxEvents?: number;
}): Promise<GraphDeltaSyncResult> {
  const maxEvents = input.maxEvents ?? 10_000;
  const events: GraphEvent[] = [];
  const seenLinks = new Set<string>();

  let url =
    input.deltaUrl ??
    buildInitialDeltaUrl(input.externalCalendarId, input.windowStart, input.windowEnd);

  let pages = 0;
  let finalDeltaLink: string | null = null;
  let warnings = 0;

  while (url) {
    if (seenLinks.has(url)) {
      throw new ValidationError("Microsoft Graph pagination loop detected.");
    }
    seenLinks.add(url);

    pages += 1;
    if (pages > GRAPH_MAX_PAGES) {
      throw new ValidationError("Microsoft event sync exceeded pagination limits.");
    }

    const page = await fetchGraphDeltaPage(input.accessToken, url);
    events.push(...page.events);

    if (events.length > maxEvents) {
      throw new ValidationError("Microsoft event sync exceeded event count limits.");
    }

    if (page.deltaLink) {
      finalDeltaLink = page.deltaLink;
    }

    if (page.nextLink) {
      url = page.nextLink;
      continue;
    }

    if (page.deltaLink) {
      break;
    }

    warnings += 1;
    break;
  }

  if (!finalDeltaLink) {
    throw new ValidationError("Microsoft Graph did not return a delta link.");
  }

  return {
    events,
    deltaLink: finalDeltaLink,
    warnings,
  };
}
