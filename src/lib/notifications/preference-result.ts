export type UpdateNotificationPreferencesResult =
  | { ok: true; refreshWarning?: string }
  | {
      ok: false;
      code:
        | "UNAUTHENTICATED"
        | "VALIDATION_FAILED"
        | "PREFERENCES_NOT_FOUND"
        | "DATABASE_ERROR"
        | "UNKNOWN_ERROR";
      message: string;
      fieldErrors?: Record<string, string>;
    };

export type NotificationPreferencesMutationStage =
  | "auth"
  | "validation"
  | "mutation"
  | "zero_rows"
  | "revalidation"
  | "complete";

export function logNotificationPreferencesDiagnostic(input: {
  operation: string;
  stage: NotificationPreferencesMutationStage;
  code?: string;
  supabaseCode?: string | null;
  mutationCompleted: boolean;
  revalidationCompleted: boolean;
}): void {
  if (input.stage === "complete" && !input.code) {
    return;
  }

  console.error(
    [
      "notification_preferences",
      `operation=${input.operation}`,
      `stage=${input.stage}`,
      `code=${input.code ?? "none"}`,
      `supabaseCode=${input.supabaseCode ?? "none"}`,
      `mutationCompleted=${input.mutationCompleted}`,
      `revalidationCompleted=${input.revalidationCompleted}`,
    ].join(" "),
  );
}
