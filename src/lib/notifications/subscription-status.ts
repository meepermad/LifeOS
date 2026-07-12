export type DeviceSubscriptionState =
  | "unsupported"
  | "not_subscribed"
  | "browser_only"
  | "registered";

export function reconcileDeviceSubscriptionState(input: {
  supported: boolean;
  browserHasSubscription: boolean;
  endpointRegisteredInDb: boolean;
}): DeviceSubscriptionState {
  if (!input.supported) {
    return "unsupported";
  }

  if (!input.browserHasSubscription) {
    return "not_subscribed";
  }

  if (input.endpointRegisteredInDb) {
    return "registered";
  }

  return "browser_only";
}

export function deviceSubscriptionLabel(state: DeviceSubscriptionState): string {
  switch (state) {
    case "registered":
      return "Active";
    case "browser_only":
      return "Not saved";
    case "not_subscribed":
      return "Not subscribed";
    case "unsupported":
      return "Unavailable";
    default:
      return "Not subscribed";
  }
}

export function deviceSubscriptionHint(state: DeviceSubscriptionState): string | null {
  switch (state) {
    case "browser_only":
      return "This device has a browser push subscription, but LifeOS has not saved it yet. Tap Enable notifications to finish setup.";
    case "not_subscribed":
      return null;
    case "registered":
      return null;
    default:
      return null;
  }
}

export function canEnableForDeviceState(
  state: DeviceSubscriptionState,
): boolean {
  return state === "not_subscribed" || state === "browser_only";
}
