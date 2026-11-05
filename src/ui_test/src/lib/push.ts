// Web Push subscription management (admin alerts + announcements). Pairs with
// functions/api/_lib/push.ts (server sender) and the push handlers in
// public/sw.js. Works while the PWA is closed — the push service wakes the
// service worker. iOS requires the PWA installed to the home screen (16.4+).

import { getToken } from "$lib/api/account";

/** VAPID public key — pairs with the VAPID_PRIVATE_JWK Pages secret. */
const VAPID_PUBLIC_KEY =
  "BCa52K0RFyN6R0eks8E2s5X6HobrJF-IwPnv3yFOhKGsxkoASG0WSmVfLtwQBXWhvelHCo3K05mCmj1r9DTI67g";

function urlB64ToUint8Array(base64: string): Uint8Array {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  // In dev the SW isn't registered (see pwa/register.ts) — this returns null
  // rather than hanging on `.ready`.
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  const reg = await registration();
  return reg ? await reg.pushManager.getSubscription() : null;
}

/** Ask permission, subscribe this device, and register it with the server.
 * Returns an error string, or null on success. */
export async function enablePush(): Promise<string | null> {
  if (!pushSupported()) return "Push isn't supported in this browser";
  const reg = await registration();
  if (!reg) return "Service worker not active (production builds only)";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "Notification permission was denied";

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    } catch {
      return "Push subscription failed — check browser settings";
    }
  }

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken() ?? ""}`,
    },
    body: JSON.stringify(sub.toJSON()),
  }).catch(() => null);
  if (!res || !res.ok) return "Failed to register the subscription with the server";
  return null;
}

export async function disablePush(): Promise<void> {
  const sub = await currentPushSubscription();
  if (!sub) return;
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken() ?? ""}`,
    },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
}
