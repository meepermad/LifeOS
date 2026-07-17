import { describe, expect, it } from "vitest";
import {
  COMMAND_REGISTRY,
  findCommandById,
  matchRegisteredCommands,
} from "@/lib/search/command-registry";
import { categoryLabel } from "@/lib/search/types";

describe("command registry", () => {
  it("includes core navigation and action commands", () => {
    expect(COMMAND_REGISTRY.some((c) => c.id === "nav-today")).toBe(true);
    expect(COMMAND_REGISTRY.some((c) => c.actionId === "stop-timer")).toBe(true);
    expect(COMMAND_REGISTRY.some((c) => c.href === "/settings/data")).toBe(true);
  });

  it("matches commands by keyword", () => {
    const results = matchRegisteredCommands("export");
    expect(results.some((item) => item.href === "/settings/data")).toBe(true);
  });

  it("finds commands by id", () => {
    expect(findCommandById("cmd-stop-timer")?.actionId).toBe("stop-timer");
  });

  it("labels new search categories", () => {
    expect(categoryLabel("work_shift")).toBe("Work shifts");
    expect(categoryLabel("notification")).toBe("Notifications");
  });
});
