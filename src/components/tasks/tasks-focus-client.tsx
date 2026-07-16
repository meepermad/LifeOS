"use client";

import { useScrollToFocusId } from "@/components/navigation/focus-target";

export function TasksFocusClient({ focusId }: { focusId: string | null }) {
  useScrollToFocusId(focusId);
  return null;
}
