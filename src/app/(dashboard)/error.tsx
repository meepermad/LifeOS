"use client";

import { RecoverableError } from "@/components/ui/recoverable-error";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RecoverableError error={error} reset={reset} />;
}
