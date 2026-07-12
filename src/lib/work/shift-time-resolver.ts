export type ResolvedShiftTime = {
  startTime: string;
  endTime: string;
  isOvernight: boolean;
  requiresConfirmation: boolean;
};

export type ShiftTimeClarification = {
  kind: "clarification";
  prompt: string;
};

export type ShiftTimeResult =
  | { kind: "resolved"; value: ResolvedShiftTime }
  | ShiftTimeClarification;

type Candidate = ResolvedShiftTime & { score: number };

function parseMeridiemHour(token: string): number[] {
  const trimmed = token.trim().toLowerCase();
  const match12 = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (match12) {
    let hour = Number.parseInt(match12[1], 10);
    const meridiem = match12[3].toLowerCase();
    if (hour === 12) hour = meridiem === "am" ? 0 : 12;
    else if (meridiem === "pm") hour += 12;
    return [hour];
  }

  const match24 = trimmed.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (match24) {
    const hour = Number.parseInt(match24[1], 10);
    if (hour >= 0 && hour <= 23) {
      if (hour <= 12) {
        const candidates: number[] = [];
        if (hour === 12) {
          candidates.push(0, 12);
        } else {
          candidates.push(hour, hour + 12);
        }
        return candidates;
      }
      return [hour];
    }
  }

  return [];
}

function parseMinute(token: string): number {
  const match = token.trim().match(/:(\d{2})/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function toTimeString(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function durationMinutes(
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
  isOvernight: boolean,
): number {
  const start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;
  if (isOvernight || end <= start) {
    end += 24 * 60;
  }
  return end - start;
}

function scoreCandidate(
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
  isOvernight: boolean,
  explicitMeridiem: boolean,
): number {
  const duration = durationMinutes(
    startHour,
    startMinute,
    endHour,
    endMinute,
    isOvernight,
  );

  if (duration <= 0) return -1000;

  let score = 0;

  if (duration >= 4 * 60 && duration <= 10 * 60) score += 50;
  else if (duration >= 2 * 60 && duration <= 14 * 60) score += 20;
  else score -= 30;

  if (!isOvernight) score += 30;
  if (explicitMeridiem) score += 10;

  if (!isOvernight && startHour >= 6 && endHour <= 23) score += 15;

  return score;
}

export function resolveShiftTimeRange(text: string): ShiftTimeResult {
  const normalized = text.trim().toLowerCase();
  const rangeMatch = normalized.match(
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|–|-|—)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
  );

  if (!rangeMatch) {
    return {
      kind: "clarification",
      prompt: "Please provide a start and end time, such as 2 to 10 or 10 AM to 6:30 PM.",
    };
  }

  const endHasMeridiem = /(am|pm)/i.test(rangeMatch[2]);
  const startHasMeridiem = /(am|pm)/i.test(rangeMatch[1]);
  let startToken = rangeMatch[1];
  if (endHasMeridiem && !startHasMeridiem) {
    const endMeridiem = rangeMatch[2].match(/(am|pm)/i)?.[1];
    if (endMeridiem) {
      startToken = `${startToken} ${endMeridiem}`;
    }
  }

  const startHours = parseMeridiemHour(startToken);
  const endHours = parseMeridiemHour(rangeMatch[2]);
  const startMinute = parseMinute(rangeMatch[1]);
  const endMinute = parseMinute(rangeMatch[2]);
  const explicitMeridiem = startHasMeridiem || endHasMeridiem;

  if (startHours.length === 0 || endHours.length === 0) {
    return {
      kind: "clarification",
      prompt: "I could not understand those times. Please include AM or PM if needed.",
    };
  }

  const candidates: Candidate[] = [];

  for (const startHour of startHours) {
    for (const endHour of endHours) {
      const sameDay = endHour > startHour || (endHour === startHour && endMinute > startMinute);
      const overnight = !sameDay;

      if (!overnight && endHour * 60 + endMinute <= startHour * 60 + startMinute) {
        continue;
      }

      const score = scoreCandidate(
        startHour,
        startMinute,
        endHour,
        endMinute,
        overnight,
        explicitMeridiem,
      );

      if (score > -500) {
        candidates.push({
          startTime: toTimeString(startHour, startMinute),
          endTime: toTimeString(endHour, endMinute),
          isOvernight: overnight,
          requiresConfirmation:
            durationMinutes(startHour, startMinute, endHour, endMinute, overnight) >
            12 * 60,
          score,
        });
      }
    }
  }

  if (candidates.length === 0) {
    return {
      kind: "clarification",
      prompt: "Those times do not form a valid shift. Please check start and end.",
    };
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const second = candidates[1];

  if (second && best.score - second.score < 5) {
    return {
      kind: "clarification",
      prompt:
        "I need to know whether you mean morning or evening for that shift.",
    };
  }

  return {
    kind: "resolved",
    value: {
      startTime: best.startTime,
      endTime: best.endTime,
      isOvernight: best.isOvernight,
      requiresConfirmation: best.requiresConfirmation,
    },
  };
}
