import { describe, expect, it } from "vitest";
import {
  matchLocalCommands,
  normalizeSearchQuery,
  SEARCH_MAX_QUERY_LENGTH,
} from "@/lib/search/types";

describe("search types", () => {
  it("truncates long queries", () => {
    const long = "a".repeat(SEARCH_MAX_QUERY_LENGTH + 20);
    expect(normalizeSearchQuery(long)).toHaveLength(SEARCH_MAX_QUERY_LENGTH);
  });

  it("returns navigation commands for empty query", () => {
    const results = matchLocalCommands("");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((item) => item.category === "command")).toBe(true);
  });

  it("filters commands by title", () => {
    const results = matchLocalCommands("calendar");
    expect(results.some((item) => item.href === "/calendar")).toBe(true);
  });
});
