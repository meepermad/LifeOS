import { ValidationError } from "@/lib/errors/app-error";
import { validateCanvasFeedUrl } from "@/lib/integrations/canvas/url-validation";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;

const ACCEPTED_CONTENT_TYPES = [
  "text/calendar",
  "application/ics",
  "text/plain",
  "application/octet-stream",
  "application/calendar",
];

function isAcceptedContentType(contentType: string | null): boolean {
  if (!contentType) {
    return true;
  }

  const normalized = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return ACCEPTED_CONTENT_TYPES.some(
    (accepted) => normalized === accepted || normalized.includes("calendar"),
  );
}

async function readResponseBody(response: Response): Promise<string> {
  if (!response.body) {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) {
      throw new ValidationError("Canvas feed response is too large");
    }
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (!value) {
      continue;
    }

    totalBytes += value.byteLength;
    if (totalBytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new ValidationError("Canvas feed response is too large");
    }

    chunks.push(value);
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function fetchWithTimeout(
  url: URL,
  signal: AbortSignal,
): Promise<Response> {
  const response = await fetch(url.toString(), {
    method: "GET",
    redirect: "manual",
    signal,
    headers: {
      Accept: "text/calendar, application/ics, text/plain, */*",
      "User-Agent": "LifeOS/1.0 Canvas-ICS-Sync",
    },
  });

  return response;
}

export type FetchFeedResult = {
  body: string;
  finalUrl: string;
};

export async function fetchCanvasFeed(urlString: string): Promise<FetchFeedResult> {
  let currentUrl = validateCanvasFeedUrl(urlString);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
      const response = await fetchWithTimeout(currentUrl, controller.signal);

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          throw new ValidationError("Canvas feed redirect is missing a location");
        }

        if (redirectCount === MAX_REDIRECTS) {
          throw new ValidationError("Canvas feed exceeded redirect limit");
        }

        currentUrl = validateCanvasFeedUrl(new URL(location, currentUrl).toString());
        continue;
      }

      if (!response.ok) {
        throw new ValidationError(
          `Canvas feed request failed with status ${response.status}`,
        );
      }

      if (!isAcceptedContentType(response.headers.get("content-type"))) {
        throw new ValidationError("Canvas feed returned an unexpected content type");
      }

      const body = await readResponseBody(response);
      if (!body.trim()) {
        throw new ValidationError("Canvas feed response is empty");
      }

      return {
        body,
        finalUrl: currentUrl.toString(),
      };
    }

    throw new ValidationError("Canvas feed request failed");
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ValidationError("Canvas feed request timed out");
    }

    throw new ValidationError("Canvas feed request failed");
  } finally {
    clearTimeout(timeout);
  }
}
