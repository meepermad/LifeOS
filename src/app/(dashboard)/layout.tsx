import { InitializationError } from "@/components/auth/initialization-error";
import { ensureUserInitialized } from "@/lib/data/bootstrap";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { BottomNavigation } from "@/components/navigation/bottom-navigation";
import { DesktopSidebar } from "@/components/navigation/desktop-sidebar";
import { DashboardHeader } from "@/components/navigation/dashboard-header";
import { PersistentTimerBar } from "@/components/timer/persistent-timer-bar";
import { StaleTimerBanner } from "@/components/timer/stale-timer-banner";
import { CommandPaletteProvider } from "@/components/search/command-palette-provider";
import { NotificationNavigateListener } from "@/components/notifications/notification-navigate-listener";
import { getAppVersionLabel } from "@/lib/status/system-status";

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
      <NotificationNavigateListener />
      <DesktopSidebar />
      <DashboardHeader
        email={user.email ?? "Account"}
        versionLabel={getAppVersionLabel()}
      />

      <main className="mx-auto max-w-lg px-4 pb-28 pt-4 lg:ml-56 lg:max-w-6xl xl:max-w-7xl">
        {initError ? <InitializationError message={initError} /> : children}
      </main>

      <PersistentTimerBar />
      <StaleTimerBanner />
      <BottomNavigation />
      <CommandPaletteProvider />
    </div>
  );
}
