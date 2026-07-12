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
