// @harness-uid u_vcpbpha6lw
/** Daniel's quiet window for browser notifications. Times are Europe/Lisbon "HH:MM". */
export interface PushQuietHours {
	enabled: boolean;
	start: string;
	end: string;
}

/** One browser's push address and the keys its messages are encrypted for. */
export interface PushSubscriptionTarget {
	endpoint: string;
	keys: { p256dh: string; auth: string };
}

/** What the Hub gives the sender: where to deliver, and when not to. */
export interface PushSenderView {
	quiet: PushQuietHours;
	subscriptions: PushSubscriptionTarget[];
}

/** What the sender tells the Hub afterwards. A gone address is removed. */
export interface PushSenderReport {
	delivered: string[];
	gone: string[];
}

/** The decrypted message the service worker shows. `needs` is one item id, or "all". */
export interface NeedsYouPushMessage {
	title: string;
	body: string;
	needs: string;
}

/** Closed-browser approval alerts carry no account or device details. */
export type WebPushMessage = NeedsYouPushMessage | { kind: 'device-approval' };
