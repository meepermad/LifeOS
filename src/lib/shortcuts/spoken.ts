import type { SpokenDetailLevel } from "@/types/domain";
import type { ShortcutCommandResponse } from "@/lib/shortcuts/schemas";

const MAX_SPOKEN_LENGTH = 300;

export function truncateSpoken(text: string): string {
  if (text.length <= MAX_SPOKEN_LENGTH) return text;
  return `${text.slice(0, MAX_SPOKEN_LENGTH - 1).trim()}…`;
}

export function sanitizeSpokenText(text: string): string {
  return truncateSpoken(
    text
      .replace(
        /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
        "",
      )
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

export function toSpokenResponse(input: {
  content: string;
  detailLevel: SpokenDetailLevel;
  privateText?: string;
}): Pick<ShortcutCommandResponse, "spokenText" | "displayText"> {
  const displayText = input.content;
  const spokenText =
    input.detailLevel === "private" && input.privateText
      ? sanitizeSpokenText(input.privateText)
      : sanitizeSpokenText(input.content);

  return { spokenText, displayText };
}

export function spokenForWritePreview(count: number): {
  spokenText: string;
  displayText: string;
} {
  const label =
    count === 1 ? "one work shift" : `${count} work shifts`;
  return {
    spokenText: `I prepared ${label} for review in LifeOS.`,
    displayText: `${count} work shift${count === 1 ? "" : "s"} are ready for review.`,
  };
}

export function spokenForInboxCount(count: number): {
  spokenText: string;
  displayText: string;
} {
  if (count === 0) {
    return {
      spokenText: "Your inbox is clear.",
      displayText: "Your inbox is clear.",
    };
  }
  return {
    spokenText: `You have ${count} inbox item${count === 1 ? "" : "s"}.`,
    displayText: `You have ${count} inbox item${count === 1 ? "" : "s"} to triage.`,
  };
}

export function spokenForAwaitingFeedback(count: number): {
  spokenText: string;
  displayText: string;
} {
  if (count === 0) {
    return {
      spokenText: "No focus blocks need feedback.",
      displayText: "No focus blocks need feedback.",
    };
  }
  return {
    spokenText: `${count} focus block${count === 1 ? "" : "s"} need feedback.`,
    displayText: `${count} past focus block${count === 1 ? "" : "s"} need your feedback.`,
  };
}

export function spokenForPendingDecisions(input: {
  overdue: number;
  waiting: number;
  inbox: number;
  feedback: number;
}): { spokenText: string; displayText: string } {
  const parts: string[] = [];
  if (input.overdue > 0) {
    parts.push(
      `${input.overdue} overdue task${input.overdue === 1 ? "" : "s"}`,
    );
  }
  if (input.waiting > 0) {
    parts.push(
      `${input.waiting} waiting follow-up${input.waiting === 1 ? "" : "s"}`,
    );
  }
  if (input.inbox > 0) {
    parts.push(`${input.inbox} inbox item${input.inbox === 1 ? "" : "s"}`);
  }
  if (input.feedback > 0) {
    parts.push(
      `${input.feedback} block${input.feedback === 1 ? "" : "s"} awaiting feedback`,
    );
  }
  if (parts.length === 0) {
    return {
      spokenText: "Nothing needs a decision right now.",
      displayText: "Nothing needs a decision right now.",
    };
  }
  const summary = parts.join(", ");
  return {
    spokenText: `Pending: ${summary}.`,
    displayText: `Pending decisions: ${summary}.`,
  };
}

export function spokenForRecurringCount(count: number): {
  spokenText: string;
  displayText: string;
} {
  if (count === 0) {
    return {
      spokenText: "You have no active recurring tasks.",
      displayText: "You have no active recurring tasks.",
    };
  }
  return {
    spokenText: `You have ${count} active recurring task${count === 1 ? "" : "s"}.`,
    displayText: `${count} active recurring task${count === 1 ? "" : "s"}.`,
  };
}

export function spokenForUnscheduledShelf(count: number): {
  spokenText: string;
  displayText: string;
} {
  if (count === 0) {
    return {
      spokenText: "No unscheduled actionable tasks on the shelf.",
      displayText: "No unscheduled actionable tasks on the shelf.",
    };
  }
  return {
    spokenText: `${count} task${count === 1 ? "" : "s"} need scheduling.`,
    displayText: `${count} actionable task${count === 1 ? "" : "s"} have unscheduled work on the calendar shelf.`,
  };
}

export function spokenForWeeklyReviewIncomplete(): {
  spokenText: string;
  displayText: string;
} {
  return {
    spokenText: "Your weekly review is not complete yet.",
    displayText: "Your weekly review is not complete yet.",
  };
}
