import { supabase } from '../lib/supabase';

// Subscribing this device to alerts.
//
// The public key is fetched from the server rather than baked into the bundle, so
// rotating the key pair does not need a redeploy of the app.
const urlBase64ToUint8Array = (base64: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalised);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
};

export type PushState = 'unsupported' | 'blocked' | 'off' | 'on';

export const pushService = {
  // iOS only exposes push to a site that has been added to the home screen, so
  // "unsupported" here is often "not installed yet" rather than "never".
  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  },

  async getState(): Promise<PushState> {
    if (!this.isSupported()) return 'unsupported';
    if (Notification.permission === 'denied') return 'blocked';

    const registration = await navigator.serviceWorker.getRegistration();
    const existing = await registration?.pushManager.getSubscription();

    return existing ? 'on' : 'off';
  },

  async enable(userId: string, organizationId: string): Promise<PushState> {
    if (!this.isSupported()) return 'unsupported';

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';

    const registration = await navigator.serviceWorker.ready;

    // Fetched rather than bundled, so rotating the key pair does not need the app
    // redeployed. Only the public half is reachable; the signing key sits in a
    // table no client role can read.
    const { data: publicKey, error: keyError } = await supabase.rpc('get_vapid_public_key');

    if (keyError || !publicKey) {
      throw new Error('No push key is configured for this app.');
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    const json = subscription.toJSON();

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        organization_id: organizationId,
        endpoint: json.endpoint!,
        p256dh: json.keys!.p256dh,
        auth: json.keys!.auth,
      },
      { onConflict: 'endpoint' }
    );

    if (error) throw error;

    return 'on';
  },

  async disable(): Promise<PushState> {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      // Removed server-side too, otherwise the job keeps posting to an endpoint
      // the browser has already stopped listening on.
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    }

    return 'off';
  },
};
