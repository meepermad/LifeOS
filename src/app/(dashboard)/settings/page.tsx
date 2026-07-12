import Link from "next/link";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { listAvailabilityRules } from "@/lib/data/availability";
import { listCalendars } from "@/lib/data/calendars";
import { getCanvasConnectionSafe } from "@/lib/data/connections";
import { getMicrosoftConnectionSafe } from "@/lib/data/microsoft-connections";
import { getProfile } from "@/lib/data/bootstrap";
import { getPlanningPreferences } from "@/lib/data/preferences";
import { listUserDevices } from "@/lib/data/push-subscriptions";
import { getOptionalVapidPublicKey } from "@/lib/security/env";
import { isMicrosoftIntegrationEnabled } from "@/lib/integrations/microsoft/feature-flag";
import { AvailabilitySettings } from "@/components/settings/availability-settings";
import { CalendarsSettings } from "@/components/settings/calendars-settings";
import { PlanningPreferencesForm } from "@/components/settings/planning-preferences-form";
import { ProfileSettingsForm } from "@/components/settings/profile-settings";
import { NotificationSettings } from "@/components/notifications/notification-settings";
import { SectionCard } from "@/components/forms/ui";
import { ShortcutDeviceSettings } from "@/components/settings/shortcut-device-settings";
import { listShortcutDevices } from "@/lib/data/shortcut-devices";
import { getServerEnv } from "@/lib/security/env";

export default async function SettingsPage() {
  const user = await requireAllowedUser();
  const microsoftEnabled = isMicrosoftIntegrationEnabled();
  const [profile, preferences, calendars, availabilityRules, canvasConnection, devices, shortcutDevices] =
    await Promise.all([
      getProfile(),
      getPlanningPreferences(),
      listCalendars(),
      listAvailabilityRules(),
      getCanvasConnectionSafe(),
      listUserDevices(),
      listShortcutDevices(),
    ]);
  const shortcutApiUrl = `${getServerEnv().NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? ""}/api/shortcuts/command`;
  const microsoftConnection = microsoftEnabled
    ? await getMicrosoftConnectionSafe()
    : null;

  const vapidPublicKey = getOptionalVapidPublicKey();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Profile, calendars, availability, and planning preferences.
        </p>
      </div>

      <SectionCard title="Profile">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Email</dt>
            <dd className="text-right text-foreground">{user.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Time zone</dt>
            <dd className="text-right text-foreground">{profile.timezone}</dd>
          </div>
        </dl>
        <div className="mt-4">
          <ProfileSettingsForm weekStartsOn={profile.week_starts_on} />
        </div>
      </SectionCard>

      <SectionCard title="Local calendars" description="Default calendars cannot be deleted in this phase.">
        <CalendarsSettings calendars={calendars} />
      </SectionCard>

      <SectionCard title="Availability" description="Weekly windows for future workload calculations.">
        <AvailabilitySettings rules={availabilityRules} />
      </SectionCard>

      <SectionCard
        title="Notifications"
        description="Web Push alerts for daily plans, weekly outlook, and workload warnings."
      >
        <NotificationSettings
          preferences={preferences}
          devices={devices}
          vapidPublicKey={vapidPublicKey}
        />
      </SectionCard>

      <SectionCard title="Planning preferences">
        <PlanningPreferencesForm
          preferences={preferences}
          weekStartsOn={profile.week_starts_on}
        />
      </SectionCard>

      <SectionCard title="Connections">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Canvas</dt>
            <dd className="text-right text-foreground">
              {canvasConnection.isConfigured
                ? canvasConnection.displayLabel
                : "Not connected"}
            </dd>
          </div>
          {canvasConnection.isConfigured && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Canvas status</dt>
              <dd className="text-right capitalize text-foreground">
                {canvasConnection.status}
              </dd>
            </div>
          )}
          {microsoftEnabled && microsoftConnection && (
            <>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Microsoft 365</dt>
                <dd className="text-right text-foreground">
                  {microsoftConnection.isConfigured
                    ? microsoftConnection.displayLabel
                    : "Not connected"}
                </dd>
              </div>
              {microsoftConnection.isConfigured && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Microsoft status</dt>
                  <dd className="text-right capitalize text-foreground">
                    {microsoftConnection.status}
                    {microsoftConnection.requiresReauthentication
                      ? " (reconnect required)"
                      : ""}
                  </dd>
                </div>
              )}
            </>
          )}
        </dl>
        <Link
          href="/imports"
          className="mt-3 inline-block text-sm text-accent hover:text-accent-hover"
        >
          Manage imports →
        </Link>
      </SectionCard>

      <SectionCard
        title="Siri and Shortcuts"
        description="Connect Apple Shortcuts to send commands to LifeOS."
      >
        <ShortcutDeviceSettings
          initialDevices={shortcutDevices}
          apiUrl={shortcutApiUrl}
        />
      </SectionCard>

      <SectionCard title="PWA">
        <p className="text-sm text-foreground/80">
          Add LifeOS to your Home Screen for standalone mode. On iPhone, open
          Share → Add to Home Screen.
        </p>
      </SectionCard>
    </div>
  );
}
