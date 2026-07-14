"use server";

import { searchLifeOs } from "@/lib/search/search";
import { normalizeSearchQuery } from "@/lib/search/types";
import type { SearchResult } from "@/lib/search/types";
import { AppError } from "@/lib/errors/app-error";

export type SearchActionResult =
  | { success: true; results: SearchResult[] }
  | { success: false; error: string };

export async function globalSearchAction(
  rawQuery: string,
): Promise<SearchActionResult> {
  try {
    const query = normalizeSearchQuery(rawQuery);
    const results = await searchLifeOs(query);
    return { success: true, results };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Could not refresh search results." };
  }
}
