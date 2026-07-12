"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  listShortcutDevicesAction,
  registerShortcutDeviceAction,
  revokeShortcutDeviceAction,
  rotateShortcutDeviceTokenAction,
  testShortcutDeviceAction,
  updateShortcutDeviceAction,
} from "@/lib/actions/shortcuts";
import type { ShortcutDeviceSummary } from "@/lib/data/shortcut-devices";
import {
  FormField,
  inputClassName,
  PrimaryButton,
  SecondaryButton,
} from "@/components/forms/ui";

type Props = {
  initialDevices: ShortcutDeviceSummary[];
  apiUrl: string;
};

export function ShortcutDeviceSettings({ initialDevices, apiUrl }: Props) {
  const router = useRouter();
  const [devices, setDevices] = useState(initialDevices);
  const [name, setName] = useState("");
  const [spokenDetailLevel, setSpokenDetailLevel] = useState<"private" | "detailed">(
    "private",
  );
  const [oneTimeToken, setOneTimeToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeDevices = useMemo(
    () => devices.filter((device) => !device.revokedAt),
    [devices],
  );

  async function refreshDevices() {
    const result = await listShortcutDevicesAction();
    if (result.success && result.data) {
      setDevices(result.data.devices);
    }
  }

  function handleRegister() {
    startTransition(async () => {
      const result = await registerShortcutDeviceAction({
        name,
        spokenDetailLevel,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOneTimeToken(result.data?.token ?? null);
      setName("");
      setMessage("Shortcut device registered. Copy the token now — it will not be shown again.");
      setError(null);
      await refreshDevices();
      router.refresh();
    });
  }

  function handleRotate(deviceId: string) {
    startTransition(async () => {
      const result = await rotateShortcutDeviceTokenAction(deviceId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOneTimeToken(result.data?.token ?? null);
      setMessage("Token rotated. Copy the new token now — it will not be shown again.");
      setError(null);
      await refreshDevices();
      router.refresh();
    });
  }

  function handleRevoke(deviceId: string) {
    startTransition(async () => {
      const result = await revokeShortcutDeviceAction(deviceId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setMessage("Shortcut device revoked.");
      setError(null);
      await refreshDevices();
      router.refresh();
    });
  }

  function handleTest(deviceId: string) {
    startTransition(async () => {
      const result = await testShortcutDeviceAction(deviceId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setMessage(result.data?.message ?? "Device is registered.");
      setError(null);
    });
  }

  function handleDetailLevelChange(
    deviceId: string,
    deviceName: string,
    level: "private" | "detailed",
  ) {
    startTransition(async () => {
      const result = await updateShortcutDeviceAction({
        deviceId,
        name: deviceName,
        spokenDetailLevel: level,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      await refreshDevices();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-danger">
        Anyone with this shortcut token can send commands to your LifeOS account. Do
        not share the shortcut or token.
      </p>

      <FormField label="API URL" htmlFor="shortcut-api-url">
        <input id="shortcut-api-url" className={inputClassName} readOnly value={apiUrl} />
      </FormField>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Device name" htmlFor="shortcut-device-name">
          <input
            id="shortcut-device-name"
            className={inputClassName}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Atem's iPhone"
          />
        </FormField>
        <FormField label="Spoken detail level" htmlFor="shortcut-detail-level">
          <select
            id="shortcut-detail-level"
            className={inputClassName}
            value={spokenDetailLevel}
            onChange={(e) =>
              setSpokenDetailLevel(e.target.value as "private" | "detailed")
            }
          >
            <option value="private">Private</option>
            <option value="detailed">Detailed</option>
          </select>
        </FormField>
      </div>

      <PrimaryButton onClick={handleRegister} loading={isPending} disabled={!name.trim()}>
        Register shortcut device
      </PrimaryButton>

      {oneTimeToken && (
        <div className="rounded-lg border border-accent/40 bg-accent/5 p-3 space-y-2">
          <p className="text-sm font-medium">One-time setup token</p>
          <code className="block break-all rounded bg-surface p-2 text-xs">{oneTimeToken}</code>
          <SecondaryButton
            onClick={() => {
              void navigator.clipboard.writeText(oneTimeToken);
              setMessage("Token copied to clipboard.");
            }}
          >
            Copy token
          </SecondaryButton>
        </div>
      )}

      {message && <p className="text-sm text-foreground">{message}</p>}
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {activeDevices.length === 0 ? (
          <p className="text-sm text-muted">No shortcut devices registered.</p>
        ) : (
          activeDevices.map((device) => (
            <div
              key={device.id}
              className="rounded-lg border border-border p-3 space-y-2 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{device.name}</p>
                  <p className="text-muted">Token prefix: {device.tokenPrefix}</p>
                </div>
                <select
                  className={inputClassName}
                  value={device.spokenDetailLevel}
                  onChange={(e) =>
                    handleDetailLevelChange(
                      device.id,
                      device.name,
                      e.target.value as "private" | "detailed",
                    )
                  }
                >
                  <option value="private">Private</option>
                  <option value="detailed">Detailed</option>
                </select>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-xs text-muted">
                <div>
                  <dt>Last used</dt>
                  <dd>{device.lastUsedAt ?? "Never"}</dd>
                </div>
                <div>
                  <dt>Last success</dt>
                  <dd>{device.lastSuccessAt ?? "Never"}</dd>
                </div>
                <div className="col-span-2">
                  <dt>Last error</dt>
                  <dd>{device.lastErrorCode ?? "None"}</dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-2">
                <SecondaryButton onClick={() => handleTest(device.id)} disabled={isPending}>
                  Test connection
                </SecondaryButton>
                <SecondaryButton onClick={() => handleRotate(device.id)} disabled={isPending}>
                  Rotate token
                </SecondaryButton>
                <SecondaryButton onClick={() => handleRevoke(device.id)} disabled={isPending}>
                  Revoke
                </SecondaryButton>
              </div>
            </div>
          ))
        )}
      </div>

      <p className="text-sm text-muted">
        See docs/shortcuts.md in the LifeOS repository for Apple Shortcut setup steps.
      </p>
    </div>
  );
}
