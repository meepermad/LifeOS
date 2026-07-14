"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  checkEndpointRegistrationAction,
  deactivateDeviceAction,
  disableCurrentDeviceAction,
  enableNotificationsAction,
  sendTestNotificationAction,
  updateNotificationPreferencesAction,
} from "@/lib/actions/notifications";
import { NotificationStatus } from "@/components/notifications/notification-status";
import {
  FormField,
  inputClassName,
  PrimaryButton,
  selectClassName,
} from "@/components/forms/ui";
import { DAY_NAMES } from "@/lib/constants";
import { splitTimeForForm } from "@/lib/dates/timezone";
import {
  logPushEnableFailure,
  mapPersistActionFailure,
  runPushEnableBrowserFlow,
} from "@/lib/notifications/push-enable-flow";
import {
  canEnableForDeviceState,
  reconcileDeviceSubscriptionState,
} from "@/lib/notifications/subscription-status";
import { decodeVapidPublicKey } from "@/lib/notifications/vapid-client";
import {
  detectBrowserPushSupport,
  type PushSupportResult,
} from "@/lib/notifications/browser-support";
import type { DeviceSummary } from "@/lib/notifications/schemas";
import type { PlanningPreferencesRow } from "@/types/domain";

function detectIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

export function NotificationSettings({
  preferences,
  devices,
  vapidPublicKey,
}: {
  preferences: PlanningPreferencesRow;
  devices: DeviceSummary[];
  vapidPublicKey: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [endpointRegisteredInDb, setEndpointRegisteredInDb] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pushSupport, setPushSupport] = useState<PushSupportResult>({
    supported: false,
  });
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported" | "checking"
  >("checking");

  const isSupported = mounted && pushSupport.supported;
  const isIosBrowser = mounted && isIos && !isStandalone;

  const refreshSubscription = useCallback(async () => {
    if (!mounted || !pushSupport.supported) {
      setCurrentEndpoint(null);
      setEndpointRegisteredInDb(false);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      const endpoint = sub?.endpoint ?? null;
      setCurrentEndpoint(endpoint);

      if (!endpoint) {
        setEndpointRegisteredInDb(false);
        return;
      }

      const { registered } = await checkEndpointRegistrationAction(endpoint);
      setEndpointRegisteredInDb(registered);
    } catch {
      setCurrentEndpoint(null);
      setEndpointRegisteredInDb(false);
    }
  }, [mounted, pushSupport.supported]);

  useEffect(() => {
    const support = detectBrowserPushSupport();
    setPushSupport(support);
    setIsStandalone(detectStandalone());
    setIsIos(detectIos());
    setPermission(
      support.supported ? Notification.permission : "unsupported",
    );
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !pushSupport.supported) return;
    void refreshSubscription();
  }, [mounted, pushSupport.supported, refreshSubscription, devices]);

  const deviceSubscriptionState = useMemo(
    () =>
      reconcileDeviceSubscriptionState({
        supported: isSupported,
        browserHasSubscription: !!currentEndpoint,
        endpointRegisteredInDb,
      }),
    [isSupported, currentEndpoint, endpointRegisteredInDb],
  );

  const currentDeviceActive = deviceSubscriptionState === "registered";

  async function handleEnable() {
    if (!isSupported || !vapidPublicKey) {
      setError("Push notifications are not configured on the server");
      return;
    }
    if (isIosBrowser) {
      setError("Install LifeOS to your Home Screen first");
      return;
    }

    setError(null);
    setMessage(null);

    const browserResult = await runPushEnableBrowserFlow(
      {
        supported: pushSupport.supported,
        vapidPublicKey,
        serviceWorker: navigator.serviceWorker,
        notification:
          typeof Notification !== "undefined"
            ? {
                permission: Notification.permission,
                requestPermission: () => Notification.requestPermission(),
              }
            : undefined,
      },
      decodeVapidPublicKey,
    );

    if (!browserResult.ok) {
      logPushEnableFailure(browserResult);
      setError(browserResult.message);
      if (browserResult.stage === "permission") {
        setPermission(Notification.permission);
      }
      return;
    }

    setPermission(Notification.permission);

    startTransition(async () => {
      const actionResult = await enableNotificationsAction({
        endpoint: browserResult.endpoint,
        keys: browserResult.keys,
        contentEncoding: browserResult.contentEncoding,
        userAgent: navigator.userAgent,
        isStandalone,
      });

      if (!actionResult.success) {
        const failure = mapPersistActionFailure({
          error: actionResult.error,
          errorCode: actionResult.errorCode,
          httpStatus: actionResult.httpStatus,
        });
        logPushEnableFailure(failure);
        setError(actionResult.error);
        return;
      }

      setMessage("Notifications enabled on this device");
      setCurrentEndpoint(browserResult.endpoint);
      setEndpointRegisteredInDb(true);
      router.refresh();
    });
  }

  async function handleDisable() {
    setError(null);
    setMessage(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      const endpoint = subscription?.endpoint ?? currentEndpoint;

      if (subscription) {
        await subscription.unsubscribe();
      }

      if (endpoint) {
        startTransition(async () => {
          const result = await disableCurrentDeviceAction(endpoint);
          if (!result.success) {
            setError(result.error);
            return;
          }
          setMessage("This device has been unsubscribed");
          setCurrentEndpoint(null);
          setEndpointRegisteredInDb(false);
          router.refresh();
        });
      }
    } catch {
      setError("Failed to disable notifications on this device");
    }
  }

  function handleTest() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await sendTestNotificationAction();
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.subscriptionCount === 0) {
        setError("No active subscriptions found");
        return;
      }
      setMessage(
        `Test sent: ${result.successCount} succeeded, ${result.failureCount} failed, ${result.invalidCount} invalid`,
      );
    });
  }

  function handleDeactivateDevice(deviceId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deactivateDeviceAction(deviceId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleSavePreferences(formData: FormData) {
    setError(null);
    setMessage(null);

    const input = {
      notificationPrivacyMode: String(
        formData.get("notificationPrivacyMode"),
      ) as "private" | "detailed",
      dailyNotificationsEnabled: formData.get("dailyNotificationsEnabled") === "on",
      weeklyNotificationsEnabled: formData.get("weeklyNotificationsEnabled") === "on",
      deadlineNotificationsEnabled:
        formData.get("deadlineNotificationsEnabled") === "on",
      overloadNotificationsEnabled:
        formData.get("overloadNotificationsEnabled") === "on",
      deadlineWarningHours: Number(formData.get("deadlineWarningHours")),
      dailyNotificationTime: String(formData.get("dailyNotificationTime") ?? ""),
      weeklyNotificationDay: Number(formData.get("weeklyNotificationDay")),
      weeklyNotificationTime: String(formData.get("weeklyNotificationTime") ?? ""),
      quietHoursStart: String(formData.get("quietHoursStart") ?? ""),
      quietHoursEnd: String(formData.get("quietHoursEnd") ?? ""),
      morningReviewEnabled: formData.get("morningReviewEnabled") === "on",
      morningReviewTime: String(formData.get("morningReviewTime") ?? ""),
      eveningReviewEnabled: formData.get("eveningReviewEnabled") === "on",
      eveningReviewTime: String(formData.get("eveningReviewTime") ?? ""),
      weeklyReviewReminderEnabled:
        formData.get("weeklyReviewReminderEnabled") === "on",
      waitingFollowupEnabled: formData.get("waitingFollowupEnabled") === "on",
      overdueDecisionReminderEnabled:
        formData.get("overdueDecisionReminderEnabled") === "on",
      planningFeedbackReminderEnabled:
        formData.get("planningFeedbackReminderEnabled") === "on",
    };

    startTransition(async () => {
      const result = await updateNotificationPreferencesAction(input);
      if (!result.ok) {
        setMessage(null);
        setError(result.message);
        return;
      }
      setError(null);
      if (result.refreshWarning) {
        setMessage(result.refreshWarning);
      } else {
        setMessage("Notification preferences saved");
      }
      router.refresh();
    });
  }

  const canEnable =
    mounted &&
    isSupported &&
    !isIosBrowser &&
    permission !== "denied" &&
    !!vapidPublicKey &&
    canEnableForDeviceState(deviceSubscriptionState);

  return (
    <div className="space-y-6">
      <NotificationStatus
        mounted={mounted}
        isSupported={isSupported}
        unsupportedReason={mounted ? pushSupport.reason : undefined}
        isStandalone={isStandalone}
        isIosBrowser={isIosBrowser}
        permission={permission}
        deviceSubscriptionState={deviceSubscriptionState}
        devices={devices}
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        {canEnable && (
          <PrimaryButton
            type="button"
            onClick={() => void handleEnable()}
            loading={isPending}
          >
            Enable notifications
          </PrimaryButton>
        )}
        {currentDeviceActive && (
          <button
            type="button"
            onClick={() => void handleDisable()}
            disabled={isPending}
            className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-surface disabled:opacity-50"
          >
            Disable this device
          </button>
        )}
        {currentDeviceActive && (
          <button
            type="button"
            onClick={handleTest}
            disabled={isPending}
            className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-surface disabled:opacity-50"
          >
            Send test notification
          </button>
        )}
      </div>

      {devices.some((d) => d.isActive) && (
        <div className="space-y-2">
          <p className="text-sm text-muted">Manage devices</p>
          {devices
            .filter((d) => d.isActive)
            .map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/70 p-2"
              >
                <span className="text-sm">{device.deviceName ?? "Device"}</span>
                <button
                  type="button"
                  onClick={() => handleDeactivateDevice(device.id)}
                  disabled={isPending}
                  className="text-sm text-danger hover:underline disabled:opacity-50"
                >
                  Deactivate
                </button>
              </div>
            ))}
        </div>
      )}

      <form action={handleSavePreferences} className="space-y-4 border-t border-border/70 pt-4">
        <FormField label="Privacy mode" htmlFor="notificationPrivacyMode">
          <select
            id="notificationPrivacyMode"
            name="notificationPrivacyMode"
            defaultValue={preferences.notification_privacy_mode}
            className={selectClassName}
          >
            <option value="private">Private (lock-screen safe)</option>
            <option value="detailed">Detailed (summary metrics)</option>
          </select>
        </FormField>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="dailyNotificationsEnabled"
            defaultChecked={preferences.daily_notifications_enabled}
            className="h-4 w-4 rounded border-border"
          />
          Daily agenda notifications
        </label>
        <FormField label="Daily notification time" htmlFor="dailyNotificationTime">
          <input
            id="dailyNotificationTime"
            name="dailyNotificationTime"
            type="time"
            defaultValue={splitTimeForForm(preferences.daily_notification_time)}
            className={inputClassName}
          />
        </FormField>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="weeklyNotificationsEnabled"
            defaultChecked={preferences.weekly_notifications_enabled}
            className="h-4 w-4 rounded border-border"
          />
          Weekly workload notifications
        </label>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Weekly day" htmlFor="weeklyNotificationDay">
            <select
              id="weeklyNotificationDay"
              name="weeklyNotificationDay"
              defaultValue={preferences.weekly_notification_day}
              className={selectClassName}
            >
              {DAY_NAMES.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Weekly time" htmlFor="weeklyNotificationTime">
            <input
              id="weeklyNotificationTime"
              name="weeklyNotificationTime"
              type="time"
              defaultValue={splitTimeForForm(preferences.weekly_notification_time)}
              className={inputClassName}
            />
          </FormField>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="deadlineNotificationsEnabled"
            defaultChecked={preferences.deadline_notifications_enabled}
            className="h-4 w-4 rounded border-border"
          />
          Deadline warnings
        </label>
        <FormField label="Warning hours ahead" htmlFor="deadlineWarningHours">
          <input
            id="deadlineWarningHours"
            name="deadlineWarningHours"
            type="number"
            min={1}
            max={168}
            defaultValue={preferences.deadline_warning_hours}
            className={inputClassName}
          />
        </FormField>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="overloadNotificationsEnabled"
            defaultChecked={preferences.overload_notifications_enabled}
            className="h-4 w-4 rounded border-border"
          />
          Overload warnings
        </label>

        <div className="space-y-3 border-t border-border/70 pt-4">
          <p className="text-sm font-medium text-foreground">Review reminders</p>
          <p className="text-xs text-muted">
            Opt-in reminders for daily and weekly reviews. Disabled by default.
          </p>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="morningReviewEnabled"
              defaultChecked={preferences.morning_review_enabled ?? false}
              className="h-4 w-4 rounded border-border"
            />
            Morning review reminder
          </label>
          <FormField label="Morning review time" htmlFor="morningReviewTime">
            <input
              id="morningReviewTime"
              name="morningReviewTime"
              type="time"
              defaultValue={splitTimeForForm(
                preferences.morning_review_time ?? "07:00",
              )}
              className={inputClassName}
            />
          </FormField>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="eveningReviewEnabled"
              defaultChecked={preferences.evening_review_enabled ?? false}
              className="h-4 w-4 rounded border-border"
            />
            Evening review reminder
          </label>
          <FormField label="Evening review time" htmlFor="eveningReviewTime">
            <input
              id="eveningReviewTime"
              name="eveningReviewTime"
              type="time"
              defaultValue={splitTimeForForm(
                preferences.evening_review_time ?? "20:00",
              )}
              className={inputClassName}
            />
          </FormField>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="weeklyReviewReminderEnabled"
              defaultChecked={preferences.weekly_review_reminder_enabled ?? false}
              className="h-4 w-4 rounded border-border"
            />
            Weekly review reminder (uses weekly day/time above)
          </label>
        </div>

        <div className="space-y-3 border-t border-border/70 pt-4">
          <p className="text-sm font-medium text-foreground">Workflow reminders</p>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="waitingFollowupEnabled"
              defaultChecked={preferences.waiting_followup_enabled ?? false}
              className="h-4 w-4 rounded border-border"
            />
            Waiting task follow-ups
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="overdueDecisionReminderEnabled"
              defaultChecked={
                preferences.overdue_decision_reminder_enabled ?? false
              }
              className="h-4 w-4 rounded border-border"
            />
            Overdue task decisions
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="planningFeedbackReminderEnabled"
              defaultChecked={
                preferences.planning_feedback_reminder_enabled ?? false
              }
              className="h-4 w-4 rounded border-border"
            />
            Planning block feedback
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Quiet hours start" htmlFor="quietHoursStart">
            <input
              id="quietHoursStart"
              name="quietHoursStart"
              type="time"
              defaultValue={splitTimeForForm(preferences.quiet_hours_start)}
              className={inputClassName}
            />
          </FormField>
          <FormField label="Quiet hours end" htmlFor="quietHoursEnd">
            <input
              id="quietHoursEnd"
              name="quietHoursEnd"
              type="time"
              defaultValue={splitTimeForForm(preferences.quiet_hours_end)}
              className={inputClassName}
            />
          </FormField>
        </div>

        {error && !message && <p className="text-sm text-danger">{error}</p>}
        {message && <p className="text-sm text-accent">{message}</p>}

        <PrimaryButton type="submit" loading={isPending} disabled={isPending}>
          Save notification preferences
        </PrimaryButton>
      </form>
    </div>
  );
}
