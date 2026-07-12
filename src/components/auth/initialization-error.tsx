export function InitializationError({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl border border-danger/30 bg-danger/10 p-4"
      role="alert"
    >
      <h2 className="text-sm font-medium text-danger">Setup error</h2>
      <p className="mt-2 text-sm text-foreground/90">{message}</p>
      <p className="mt-3 text-sm text-muted">
        Ensure the database migration has been applied to your Supabase project,
        then reload this page.
      </p>
    </div>
  );
}
