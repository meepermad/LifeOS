export const PUSH_ENABLE_STAGES = {
  SUPPORT_CHECK: "support_check",
  PERMISSION: "permission",
  SERVICE_WORKER: "service_worker",
  EXISTING_SUBSCRIPTION: "existing_subscription",
  VAPID_DECODE: "vapid_decode",
  SUBSCRIBE: "subscribe",
  SERIALIZE: "serialize",
  PERSIST: "persist",
} as const;

export type PushEnableStage =
  (typeof PUSH_ENABLE_STAGES)[keyof typeof PUSH_ENABLE_STAGES];

export type PushEnableFailure = {
  ok: false;
  stage: PushEnableStage;
  message: string;
  errorName?: string;
  errorCode?: string;
  httpStatus?: number;
};

export type PushEnableBrowserSuccess = {
  ok: true;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  contentEncoding: string | null;
};

export type PushEnableBrowserResult = PushEnableFailure | PushEnableBrowserSuccess;

export type NotificationPermissionApi = {
  permission: NotificationPermission;
  requestPermission(): Promise<NotificationPermission>;
};

export type PushEnableEnvironment = {
  supported: boolean;
  vapidPublicKey: string | null;
  serviceWorker?: ServiceWorkerContainer;
  notification?: NotificationPermissionApi;
};

function mapBrowserError(
  stage: PushEnableStage,
  error: unknown,
): PushEnableFailure {
  const errorName =
    error instanceof Error
      ? error.name
      : typeof error === "object" &&
          error !== null &&
          "name" in error &&
          typeof error.name === "string"
        ? error.name
        : "Error";

  if (errorName === "InvalidAccessError") {
    return {
      ok: false,
      stage,
      errorName,
      message: "Push subscription was rejected by the browser.",
    };
  }

  if (errorName === "NotAllowedError") {
    return {
      ok: false,
      stage: PUSH_ENABLE_STAGES.PERMISSION,
      errorName,
      message: "Notification permission was not granted.",
    };
  }

  if (errorName === "AbortError") {
    return {
      ok: false,
      stage: PUSH_ENABLE_STAGES.SERVICE_WORKER,
      errorName,
      message: "Service worker is not ready.",
    };
  }

  if (errorName === "VapidKeyError") {
    return {
      ok: false,
      stage: PUSH_ENABLE_STAGES.VAPID_DECODE,
      errorName,
      message: "The VAPID public key is invalid.",
    };
  }

  if (stage === PUSH_ENABLE_STAGES.SERVICE_WORKER) {
    return {
      ok: false,
      stage,
      errorName,
      message: "Service worker is not ready.",
    };
  }

  if (stage === PUSH_ENABLE_STAGES.SUBSCRIBE) {
    return {
      ok: false,
      stage,
      errorName,
      message: "Push subscription was rejected by the browser.",
    };
  }

  return {
    ok: false,
    stage,
    errorName,
    message: "Failed to enable notifications.",
  };
}

export function logPushEnableFailure(failure: PushEnableFailure): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  console.error(
    `Push enable failed stage=${failure.stage} name=${failure.errorName ?? "unknown"} code=${failure.errorCode ?? "unknown"} status=${failure.httpStatus ?? "n/a"}`,
  );
}

export async function resolveNotificationPermission(
  notification: NotificationPermissionApi,
): Promise<NotificationPermission> {
  if (notification.permission === "granted") {
    return "granted";
  }

  return notification.requestPermission();
}

export async function runPushEnableBrowserFlow(
  env: PushEnableEnvironment,
  decodeVapidKey: (key: string) => Uint8Array,
): Promise<PushEnableBrowserResult> {
  if (!env.supported) {
    return {
      ok: false,
      stage: PUSH_ENABLE_STAGES.SUPPORT_CHECK,
      message: "Web Push is not available in this browser.",
    };
  }

  if (!env.vapidPublicKey) {
    return {
      ok: false,
      stage: PUSH_ENABLE_STAGES.VAPID_DECODE,
      message: "Push notifications are not configured on the server.",
    };
  }

  if (!env.notification) {
    return {
      ok: false,
      stage: PUSH_ENABLE_STAGES.PERMISSION,
      message: "Notifications are not available in this browser.",
    };
  }

  let permission: NotificationPermission;
  try {
    permission = await resolveNotificationPermission(env.notification);
  } catch (error) {
    const failure = mapBrowserError(PUSH_ENABLE_STAGES.PERMISSION, error);
    logPushEnableFailure(failure);
    return failure;
  }

  if (permission !== "granted") {
    return {
      ok: false,
      stage: PUSH_ENABLE_STAGES.PERMISSION,
      message: "Notification permission was not granted.",
    };
  }

  if (!env.serviceWorker) {
    return {
      ok: false,
      stage: PUSH_ENABLE_STAGES.SERVICE_WORKER,
      message: "Service workers are not available.",
    };
  }

  let registration: ServiceWorkerRegistration;
  try {
    registration = await env.serviceWorker.ready;
  } catch (error) {
    const failure = mapBrowserError(PUSH_ENABLE_STAGES.SERVICE_WORKER, error);
    logPushEnableFailure(failure);
    return failure;
  }

  let subscription: PushSubscription | null;
  try {
    subscription = await registration.pushManager.getSubscription();
  } catch (error) {
    const failure = mapBrowserError(
      PUSH_ENABLE_STAGES.EXISTING_SUBSCRIPTION,
      error,
    );
    logPushEnableFailure(failure);
    return failure;
  }

  if (!subscription) {
    let applicationServerKey: Uint8Array;
    try {
      applicationServerKey = decodeVapidKey(env.vapidPublicKey);
    } catch (error) {
      const failure = mapBrowserError(PUSH_ENABLE_STAGES.VAPID_DECODE, error);
      logPushEnableFailure(failure);
      return failure;
    }

    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });
    } catch (error) {
      const failure = mapBrowserError(PUSH_ENABLE_STAGES.SUBSCRIBE, error);
      logPushEnableFailure(failure);
      return failure;
    }
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return {
      ok: false,
      stage: PUSH_ENABLE_STAGES.SERIALIZE,
      message: "Failed to read push subscription.",
    };
  }

  return {
    ok: true,
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    contentEncoding:
      "contentEncoding" in subscription
        ? (subscription as PushSubscription & { contentEncoding?: string })
            .contentEncoding ?? null
        : null,
  };
}

export function mapPersistActionFailure(input: {
  error: string;
  errorCode?: string;
  httpStatus?: number;
}): PushEnableFailure {
  return {
    ok: false,
    stage: PUSH_ENABLE_STAGES.PERSIST,
    message: input.error,
    errorCode: input.errorCode,
    httpStatus: input.httpStatus,
  };
}
