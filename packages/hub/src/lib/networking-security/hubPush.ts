// @harness-uid u_56mpqyme4j
import type { BrowserApi } from '../../utils/browserApi';
import {
	addressHash,
	approvalPushScope,
	confirmOn,
	currentSubscription,
	pushSupport,
	subscribe
} from './hubPushBrowser';
import type {
	ApprovalPushRequest,
	HubApprovalPushReading,
	HubPushReading,
	HubPushSettings,
	PushQuietHours
} from './hubPush.types';

const root = '/api/push';
const subscriptionPath = root + '/subscription';

const reading = (
	device: HubPushReading['device'],
	settings: HubPushSettings,
	deliveredAt: number | null = null
): HubPushReading => ({ device, settings, deliveredAt });

async function stored(api: BrowserApi, settings: HubPushSettings, held: PushSubscription) {
	const id = await addressHash(held.endpoint);
	const known = settings.browsers.find((browser) => browser.id === id);
	// A subscription the Hub no longer holds is saved again, so "on" always means deliverable.
	const next = known
		? settings
		: await api.send<HubPushSettings>('POST', subscriptionPath, held.toJSON());
	return reading('on', next, known?.deliveredAt ?? null);
}

async function onDevice(api: BrowserApi, settings: HubPushSettings): Promise<HubPushReading> {
	const device = await notificationDevice();
	return device === 'on'
		? stored(api, settings, await subscribe(settings.publicKey))
		: reading(device, settings);
}

async function notificationDevice(scope?: string): Promise<HubPushReading['device']> {
	const support = pushSupport();
	if (support !== 'supported') return support;
	if (Notification.permission === 'denied') return 'blocked';
	return Notification.permission === 'granted' && (await currentSubscription(scope)) ? 'on' : 'off';
}

/** Null when the Hub offers no notifications: not the owner, or no key configured. */
export async function readHubPush(api: BrowserApi): Promise<HubPushReading | null> {
	const settings = await api.get<HubPushSettings>(root);
	return settings.available ? onDevice(api, settings) : null;
}

/** Call straight from the tap: Safari refuses a permission prompt after any other waiting. */
export async function turnOnHubPush(
	api: BrowserApi,
	settings: HubPushSettings
): Promise<HubPushReading> {
	const permission = await Notification.requestPermission();
	if (permission !== 'granted')
		return reading(permission === 'denied' ? 'blocked' : 'off', settings);
	const subscription = await subscribe(settings.publicKey);
	const next = await api.send<HubPushSettings>('POST', subscriptionPath, subscription.toJSON());
	// The browser is subscribed and saved: a confirmation it cannot draw changes neither.
	await confirmOn().catch(() => {});
	return reading('on', next);
}

export async function turnOffHubPush(api: BrowserApi): Promise<HubPushReading | null> {
	const held = await currentSubscription();
	if (held) {
		await api.send('DELETE', subscriptionPath, { endpoint: held.endpoint });
		await held.unsubscribe();
	}
	return readHubPush(api);
}

/**
 * Before signing out: a signed-out browser must receive no decision text. Dropping the local
 * subscription is enough even if the Hub cannot be told; the push service then reports it gone.
 */
export async function forgetHubPush(api: BrowserApi): Promise<void> {
	if (pushSupport() !== 'supported') return;
	await currentSubscription(approvalPushScope)
		.then((held) => held?.unsubscribe())
		.catch(() => {});
	const held = await currentSubscription();
	if (!held) return;
	await api.send('DELETE', subscriptionPath, { endpoint: held.endpoint }).catch(() => {});
	await held.unsubscribe();
}

export function saveQuietHours(api: BrowserApi, quiet: PushQuietHours): Promise<HubPushSettings> {
	return api.send<HubPushSettings>('POST', root, { quiet });
}

/** Reuse the browser's current subscription, bound separately to this approved installation. */
export async function readApprovalPush(
	call: ApprovalPushRequest,
	alsoEnabled: boolean
): Promise<HubApprovalPushReading | null> {
	const response = await call('GET');
	if (!response.ok) return null;
	const { publicKey } = await response.json();
	if (typeof publicKey !== 'string') return null;
	const state = await notificationDevice(approvalPushScope);
	const device = state === 'off' && alsoEnabled ? 'on' : state;
	if (device === 'on') await saveApprovalPush(call, publicKey);
	return { device, publicKey };
}

export async function turnOnApprovalPush(call: ApprovalPushRequest, publicKey: string) {
	const permission = await Notification.requestPermission();
	if (permission !== 'granted')
		return { device: permission === 'denied' ? 'blocked' : 'off', publicKey } as const;
	await saveApprovalPush(call, publicKey);
	return { device: 'on', publicKey } as const;
}

async function saveApprovalPush(call: ApprovalPushRequest, publicKey: string) {
	const subscription = await subscribe(publicKey, approvalPushScope);
	const response = await call('POST', subscription.toJSON());
	if (!response.ok) throw new Error('The Hub could not save approval notifications.');
}

export async function turnOffApprovalPush(call: ApprovalPushRequest, publicKey: string) {
	const response = await call('DELETE');
	if (!response.ok) throw new Error('The Hub could not turn off approval notifications.');
	await (await currentSubscription(approvalPushScope))?.unsubscribe();
	return { device: 'off', publicKey } as const;
}
