import { MicrosoftIntegration } from "@/components/imports/microsoft-integration";
import { CanvasIntegration } from "@/components/imports/canvas-integration";
import { SectionCard } from "@/components/forms/ui";
import { getCanvasConnectionSafe } from "@/lib/data/connections";
import { getMicrosoftConnectionSafe } from "@/lib/data/microsoft-connections";
import { getMicrosoftCalendarsAction } from "@/lib/actions/microsoft";
import { requireAllowedUser } from "@/lib/auth/authorize-user";
import { isMicrosoftIntegrationEnabled } from "@/lib/integrations/microsoft/feature-flag";

export default async function ImportsPage() {
  await requireAllowedUser();
  const microsoftEnabled = isMicrosoftIntegrationEnabled();
  const canvasStatus = await getCanvasConnectionSafe();
  const [microsoftStatus, microsoftCalendars] = microsoftEnabled
    ? await Promise.all([getMicrosoftConnectionSafe(), getMicrosoftCalendarsAction()])
    : [null, []];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import Center</h1>
        <p className="mt-1 text-sm text-muted">
          Import schedules and connect external sources.
        </p>
      </div>

      {microsoftEnabled && microsoftStatus && (
        <SectionCard
          title="Microsoft 365"
          description="Import read-only Outlook calendars from your work or school account."
        >
          <MicrosoftIntegration
            initialStatus={microsoftStatus}
            initialCalendars={microsoftCalendars}
          />
        </SectionCard>
      )}

      <SectionCard
        title="Canvas ICS"
        description="Import assignments and course events from your private Canvas calendar feed."
      >
        <CanvasIntegration initialStatus={canvasStatus} />
      </SectionCard>

      <SectionCard title="Work schedule">
        <p className="text-sm text-foreground/80">
          Enter weekly work shifts on the{" "}
          <a href="/work" className="text-accent underline">
            Work schedule
          </a>{" "}
          page.
        </p>
      </SectionCard>
    </div>
  );
}
