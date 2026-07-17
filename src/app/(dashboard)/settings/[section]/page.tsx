import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { listAvailabilityRules } from "@/lib/data/availability";
import { listCalendars } from "@/lib/data/calendars";
import { getCanvasConnectionSafe } from "@/lib/data/connections";
import { getMicrosoftConnectionSafe } from "@/lib/data/microsoft-connections";
import { getProfile } from "@/lib/data/bootstrap";
import { getPlanningPreferences } from "@/lib/data/preferences";
import { listUserDevices } from "@/lib/data/push-subscriptions";
import { getOptionalVapidPublicKey, getServerEnv } from "@/lib/security/env";
import { isMicrosoftIntegrationEnabled } from "@/lib/integrations/microsoft/feature-flag";
import { AvailabilitySettings } from "@/components/settings/availability-settings";
import { CalendarsSettings } from "@/components/settings/calendars-settings";
import { PlanningPreferencesForm } from "@/components/settings/planning-preferences-form";
import { ProfileSettingsForm } from "@/components/settings/profile-settings";
import { NotificationSettings } from "@/components/notifications/notification-settings";
import { SectionCard } from "@/components/forms/ui";
import { ShortcutDeviceSettings } from "@/components/settings/shortcut-device-settings";
import { AssistantLanguageFallbackSettings } from "@/components/settings/assistant-language-fallback-settings";
import { ExportCenter } from "@/components/settings/export-center";
import { SettingsBackLink } from "@/components/settings/settings-back-link";
import { listShortcutDevices } from "@/lib/data/shortcut-devices";
import { getAiIntentRouterStatus } from "@/lib/assistant/ai-intent-router/router";
import { getAppVersionLabel } from "@/lib/status/system-status";
import {
  getSettingsSection,
  isSettingsSectionId,
  type SettingsSectionId,
} from "@/lib/settings/sections";

type Props = {
  params: Promise<{ section: string }>;
};

export function generateStaticParams() {
  return [
    { section: "general" },
    { section: "school" },
    { section: "planning" },
    { section: "notifications" },
    { section: "integrations" },
    { section: "shortcuts" },
    { section: "data" },
    { section: "advanced" },
  ];
}

export default async function SettingsSectionPage({ params }: Props) {
  const { section: raw } = await params;
  if (!isSettingsSectionId(raw)) notFound();
  const sectionId = raw as SettingsSectionId;
  const meta = getSettingsSection(sectionId);

  return (
    <div className="space-y-6">
      <div>
        <SettingsBackLink />
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {meta.title}
        </h1>
        <p className="mt-1 text-sm text-muted">{meta.description}</p>
      </div>
      <SettingsSectionBody sectionId={sectionId} />
    </div>
  );
}

async function SettingsSectionBody({
  sectionId,
}: {
  sectionId: SettingsSectionId;
}) {
  switch (sectionId) {
    case "general":
      return <GeneralSection />;
    case "school":
      return <SchoolSection />;
    case "planning":
      return <PlanningSection />;
    case "notifications":
      return <NotificationsSection />;
    case "integrations":
      return <IntegrationsSection />;
    case "shortcuts":
      return <ShortcutsSection />;
    case "data":
      return <DataSection />;
    case "advanced":
      return <AdvancedSection />;
    default: {
      const _exhaustive: never = sectionId;
      return _exhaustive;
    }
  }
}

async function GeneralSection() {
  const user = await requireAllowedUser();
  const profile = await getProfile();

  return (
    <>
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
          <div className="flex justify-between gap-4">
            <dt className="text-muted">App version</dt>
            <dd className="text-right text-foreground">{getAppVersionLabel()}</dd>
          </div>
        </dl>
        <div className="mt-4">
          <ProfileSettingsForm weekStartsOn={profile.week_starts_on} />
        </div>
      </SectionCard>

      <SectionCard title="PWA">
        <p className="text-sm text-foreground/80">
          Add LifeOS to your Home Screen for standalone mode. On iPhone, open
          Share → Add to Home Screen.
        </p>
      </SectionCard>
    </>
  );
}

async function SchoolSection() {
  return (
    <SectionCard
      title="School"
      description="Set up your semester, courses, class meetings, breaks, and Canvas class review."
    >
      <Link
        href="/school"
        className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
      >
        Open semester setup
      </Link>
    </SectionCard>
  );
}

async function PlanningSection() {
  const [profile, preferences, calendars, availabilityRules] =
    await Promise.all([
      getProfile(),
      getPlanningPreferences(),
      listCalendars(),
      listAvailabilityRules(),
    ]);

  return (
    <>
      <SectionCard
        title="Local calendars"
        description="Default calendars cannot be deleted."
      >
        <CalendarsSettings calendars={calendars} />
      </SectionCard>

      <SectionCard
        title="Availability"
        description="Weekly windows for workload calculations."
      >
        <AvailabilitySettings rules={availabilityRules} />
      </SectionCard>

      <SectionCard title="Planning preferences">
        <PlanningPreferencesForm
          preferences={preferences}
          weekStartsOn={profile.week_starts_on}
        />
      </SectionCard>
    </>
  );
}

async function NotificationsSection() {
  const [preferences, devices] = await Promise.all([
    getPlanningPreferences(),
    listUserDevices(),
  ]);
  const vapidPublicKey = getOptionalVapidPublicKey();

  return (
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
  );
}

async function IntegrationsSection() {
  const microsoftEnabled = isMicrosoftIntegrationEnabled();
  const [canvasConnection, microsoftConnection] = await Promise.all([
    getCanvasConnectionSafe(),
    microsoftEnabled ? getMicrosoftConnectionSafe() : Promise.resolve(null),
  ]);

  return (
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
  );
}

async function ShortcutsSection() {
  const shortcutDevices = await listShortcutDevices();
  const shortcutApiUrl = `${getServerEnv().NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? ""}/api/shortcuts/command`;

  return (
    <SectionCard
      title="Siri and Shortcuts"
      description="Connect Apple Shortcuts to send commands to LifeOS."
    >
      <ShortcutDeviceSettings
        initialDevices={shortcutDevices}
        apiUrl={shortcutApiUrl}
      />
    </SectionCard>
  );
}

async function DataSection() {
  return (
    <SectionCard
      title="Export center"
      description="Download read-only copies of your LifeOS planning data."
    >
      <ExportCenter />
    </SectionCard>
  );
}

async function AdvancedSection() {
  const user = await requireAllowedUser();
  const aiIntentRouterStatus = await getAiIntentRouterStatus(user.id);

  return (
    <>
      <SectionCard
        title="Assistant language fallback"
        description="Optional AI classification when deterministic parsing cannot understand a command."
      >
        <AssistantLanguageFallbackSettings
          initialStatus={aiIntentRouterStatus}
        />
      </SectionCard>

      <SectionCard title="System status">
        <Link
          href="/status"
          className="inline-flex min-h-11 items-center text-sm text-accent hover:text-accent-hover"
        >
          Open system status →
        </Link>
      </SectionCard>
    </>
  );
}
