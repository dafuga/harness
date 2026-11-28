import { createHash } from 'node:crypto';
import type { Page } from '../../../../test/support/browserTest';
import { hubHomeFixture } from './hub-home-fixture';
import type { PushFixtureOptions } from './hub-web-push-fixture.types';

export const pushAddress = 'https://fcm.googleapis.com/fcm/send/synthetic-browser';
export const publicKey =
	'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8';
const id = createHash('sha256').update(pushAddress).digest('hex');

/**
 * The Hub's notification routes, and a browser whose push service is synthetic: test browsers
 * have none, so only the permission answer and the subscription are stood in for.
 */
export async function pushBrowser(page: Page, { permission, answer }: PushFixtureOptions) {
	await page.addInitScript(
		([initial, answered, endpoint]) => {
			const stored = () => localStorage.getItem('test-push-permission') ?? initial;
			Object.defineProperty(Notification, 'permission', { get: stored });
			Notification.requestPermission = async () => {
				localStorage.setItem('test-push-permission', answered);
				return answered as NotificationPermission;
			};
			const subscription = {
				endpoint,
				options: { applicationServerKey: null },
				toJSON: () => ({ endpoint, keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) } }),
				unsubscribe: async () => (localStorage.removeItem('test-push-held'), true)
			};
			PushManager.prototype.getSubscription = async () =>
				localStorage.getItem('test-push-held') ? (subscription as never) : null;
			PushManager.prototype.subscribe = async () => {
				localStorage.setItem('test-push-held', 'yes');
				return subscription as never;
			};
		},
		[permission, answer ?? 'granted', pushAddress]
	);
}

export async function webPushFixture(page: Page, options: PushFixtureOptions) {
	await pushBrowser(page, options);
	await page.context().grantPermissions(['notifications']);
	const writes: { method: string; path: string; body: unknown }[] = [];
	const settings = {
		available: true,
		publicKey,
		quiet: { enabled: true, start: '22:00', end: '08:00' },
		browsers: [] as { id: string; deliveredAt: number | null }[]
	};
	const home = await hubHomeFixture(page, 'default');
	// Registered after the Home fixture, so these answer before its catch-all.
	await page.route(/\/api\/push(\/subscription)?$/, async (route) => {
		const request = route.request();
		const path = new URL(request.url()).pathname;
		if (request.method() !== 'GET') {
			const body = request.postDataJSON();
			writes.push({ method: request.method(), path, body });
			if (path === '/api/push') settings.quiet = body.quiet;
			else settings.browsers = request.method() === 'POST' ? [{ id, deliveredAt: null }] : [];
		}
		await route.fulfill({ json: options.unavailable ? { available: false } : settings });
	});
	const [chief] = home.snapshot.agents;
	home.snapshot.agents.push({
		...chief,
		id: 'harbor',
		name: 'harbor',
		itemId: 'item-harbor',
		question: 'Ship harbor?',
		confirm: undefined,
		messages: [],
		options: [
			{ label: 'Ship harbor now', effect: 'Merges and releases.', recommended: true },
			{ label: 'Hold harbor', effect: 'Waits a day.' }
		]
	});
	return { home, writes, settings, id };
}
