import { InitializationError } from "@/components/auth/initialization-error";
import { ensureUserInitialized } from "@/lib/data/bootstrap";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { BottomNavigation } from "@/components/navigation/bottom-navigation";
import { DesktopSidebar } from "@/components/navigation/desktop-sidebar";
import { PersistentTimerBar } from "@/components/timer/persistent-timer-bar";
import { StaleTimerBanner } from "@/components/timer/stale-timer-banner";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAllowedUser();

  let initError: string | null = null;

  try {
    await ensureUserInitialized();
  } catch (error) {
    initError =
      error instanceof Error
        ? error.message
        : "Failed to initialize your LifeOS account data.";
  }

  return (
    <div className="safe-top min-h-dvh bg-background">
      <DesktopSidebar />
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md lg:pl-56">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3 lg:max-w-6xl xl:max-w-7xl">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">
              LifeOS
            </p>
            <p className="truncate text-sm text-foreground">{user.email}</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-28 pt-4 lg:ml-56 lg:max-w-6xl xl:max-w-7xl">
        {initError ? <InitializationError message={initError} /> : children}
      </main>

      <PersistentTimerBar />
      <StaleTimerBanner />
      <BottomNavigation />
    </div>
  );
}
