import webpush from "web-push";
import { getVapidConfig } from "@/lib/security/env";

let configured = false;

export function configureWebPush(): void {
  if (configured) return;
  const { publicKey, privateKey, subject } = getVapidConfig();
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export function resetWebPushConfig(): void {
  configured = false;
}

export { webpush };
