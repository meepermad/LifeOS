const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  an: 1,
  a: 1,
};

function parseWordNumber(token: string): number | null {
  const lower = token.toLowerCase();
  if (WORD_NUMBERS[lower] != null) return WORD_NUMBERS[lower];
  const numeric = Number.parseInt(lower, 10);
  return Number.isFinite(numeric) ? numeric : null;
}

export function parseDurationMinutes(text: string): number | null {
  const normalized = text.toLowerCase().trim();

  const minutesMatch = normalized.match(
    /(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|an|a)\s*(?:-?\s*)?minutes?\b/,
  );
  if (minutesMatch) {
    const value = parseWordNumber(minutesMatch[1]);
    return value != null && value > 0 ? value : null;
  }

  const hourMatch = normalized.match(
    /(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|an|a)\s*(?:-?\s*)?(?:hour|hr)s?\b/,
  );
  if (hourMatch) {
    const value = parseWordNumber(hourMatch[1]);
    return value != null && value > 0 ? value * 60 : null;
  }

  const compactHourMatch = normalized.match(
    /(\d+)\s*(?:-?\s*)?h(?:our)?s?\b/,
  );
  if (compactHourMatch) {
    const value = Number.parseInt(compactHourMatch[1], 10);
    return value > 0 ? value * 60 : null;
  }

  return null;
}

export function extractDurationFromText(text: string): number | null {
  return parseDurationMinutes(text);
}
