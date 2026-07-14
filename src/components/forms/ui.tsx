export function FormField({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm text-muted">
        {label}
      </label>
      {children}
      {error && (
        <p id={errorId} className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClassName =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-foreground outline-none focus:border-accent disabled:opacity-50";

export const selectClassName = inputClassName;

export const textareaClassName = `${inputClassName} min-h-24 resize-y`;

export function PrimaryButton({
  children,
  loading,
  pendingLabel = "Saving…",
  disabled,
  type = "button",
  onClick,
  className,
}: {
  children: React.ReactNode;
  loading?: boolean;
  pendingLabel?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50 ${className ?? ""}`}
    >
      {loading ? pendingLabel : children}
    </button>
  );
}

export function SecondaryButton({
  children,
  loading,
  pendingLabel = "Working…",
  disabled,
  type = "button",
  onClick,
  className,
}: {
  children: React.ReactNode;
  loading?: boolean;
  pendingLabel?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`w-full rounded-lg border border-border px-4 py-2.5 text-sm text-muted transition-colors hover:border-accent hover:text-foreground disabled:opacity-50 ${className ?? ""}`}
    >
      {loading ? pendingLabel : children}
    </button>
  );
}

export function DangerButton({
  children,
  loading,
  pendingLabel = "Deleting…",
  disabled,
  onClick,
  className,
}: {
  children: React.ReactNode;
  loading?: boolean;
  pendingLabel?: string;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`w-full rounded-lg border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/20 disabled:opacity-50 ${className ?? ""}`}
    >
      {loading ? pendingLabel : children}
    </button>
  );
}

export function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface p-4">
      <div>
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-muted">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface/50 px-4 py-8 text-center">
      <p className="text-sm text-muted">{message}</p>
      {action ? (
        <a
          href={action.href}
          className="mt-4 inline-block text-sm font-medium text-accent hover:text-accent-hover"
        >
          {action.label}
        </a>
      ) : null}
    </div>
  );
}
