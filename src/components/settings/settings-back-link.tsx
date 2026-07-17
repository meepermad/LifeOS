import Link from "next/link";

export function SettingsBackLink() {
  return (
    <Link
      href="/settings"
      className="inline-flex min-h-11 items-center text-sm text-muted transition-colors hover:text-foreground"
    >
      ← Settings
    </Link>
  );
}
