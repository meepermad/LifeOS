"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { sanitizeInternalReturnPath } from "@/lib/notifications/destination";

/**
 * Handles LIFEOS_NOTIFICATION_NAVIGATE messages from the service worker
 * when WindowClient.navigate is unavailable or fails.
 */
export function NotificationNavigateListener() {
  const router = useRouter();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || data.type !== "LIFEOS_NOTIFICATION_NAVIGATE") return;
      if (typeof data.path !== "string") return;
      const path = sanitizeInternalReturnPath(data.path);
      router.push(path);
    }

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, [router]);

  return null;
}
