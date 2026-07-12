export const MICROSOFT_GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export const MICROSOFT_DELEGATED_SCOPES = [
  "openid",
  "profile",
  "offline_access",
  "User.Read",
  "Calendars.Read",
] as const;

export const MICROSOFT_SYNC_PAST_DAYS = 30;
export const MICROSOFT_SYNC_FUTURE_DAYS = 180;
export const MICROSOFT_WINDOW_RESET_BUFFER_DAYS = 7;

export const MICROSOFT_OAUTH_TX_COOKIE = "lifeos_ms_oauth_tx";
export const MICROSOFT_OAUTH_TX_MAX_AGE_SECONDS = 600;

export const GRAPH_REQUEST_TIMEOUT_MS = 30_000;
export const GRAPH_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
export const GRAPH_MAX_PAGES = 50;
export const GRAPH_MAX_EVENTS_PER_SYNC = 10_000;
export const GRAPH_MAX_RETRIES = 3;

export const GRAPH_PREFER_HEADERS = {
  timezone: 'outlook.timezone="UTC"',
  immutableId: 'IdType="ImmutableId"',
} as const;
