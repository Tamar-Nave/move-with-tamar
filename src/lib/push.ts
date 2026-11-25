import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

// Public key (safe to expose). The matching private key lives only in the Cloudflare worker.
const VAPID_PUBLIC_KEY = 'BEEFwwLivr1JwEVocAgyPYRg4GsqPGSwNAlsVy2gPbCTHP5mfJ3oKvQbdSEtbW091eplVJOvABEoS8Q5uAGet5A';

export type PushState = 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on';

const isWeb = () => Platform.OS === 'web' && typeof window !== 'undefined';

const isIos = () => isWeb() && /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  isWeb() && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);

function supported() {
  return isWeb() && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function keyToBytes(base64Url: string): Uint8Array {
  const pad = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob((base64Url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const bufferToBase64Url = (buf: ArrayBuffer | null) =>
  buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : '';

export async function getPushState(): Promise<PushState> {
  if (!supported()) return isIos() && !isStandalone() ? 'ios-install' : 'unsupported';
  if (isIos() && !isStandalone()) return 'ios-install';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

export async function enablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';

  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) as BufferSource }));

  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: sub.endpoint,
    p_p256dh: bufferToBase64Url(sub.getKey('p256dh')),
    p_auth: bufferToBase64Url(sub.getKey('auth')),
  });
  if (error) throw error;
  return 'on';
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.rpc('remove_push_subscription', { p_endpoint: sub.endpoint });
    await sub.unsubscribe();
  }
  return 'off';
}

export async function sendTestNotification() {
  return supabase.rpc('send_test_notification');
}
