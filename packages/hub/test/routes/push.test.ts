import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { TrackerWebPushService } from '../../../../src/services/projects-sessions/TrackerWebPushService';
import {
	generateWebPushKeys,
	hubSenderAuthorization,
	vapidAuthorization
} from '../../../../src/services/projects-sessions/tracker-web-push-service/webPushTokens';
import { webPushBrowser } from '../../../../test/support/webPushBrowser';
import { ORIGIN } from '../support/authFixture';
import { mac, pushHub } from '../support/pushFixture';
import { NOW, OTHER } from '../support/trackerOverviewFixture';

test('only the owner’s own browser reads or changes notification settings', async () => {
	const hub = await pushHub();
	try {
		const owner = await hub.sessions.browser();
		const other = await hub.sessions.browser(OTHER);
		const { target } = webPushBrowser(mac);
		const first = await (await hub.serve(hub.browser('GET', '', owner))).json();
		expect(first).toEqual({
			available: true,
			publicKey: hub.keys.publicKey,
			quiet: { enabled: true, start: '22:00', end: '08:00' },
			browsers: []
		});
		expect(await (await hub.serve(hub.browser('GET', '', other))).json()).toEqual({
			available: false
		});
		expect(await (await hub.serve(hub.browser('GET', '', owner), null)).json()).toEqual({
			available: false
		});
		expect(
			(await hub.serve(hub.browser('POST', '/subscription', other, { body: target }))).status
		).toBe(404);
		const crossSite = hub.browser('POST', '/subscription', owner, {
			body: target,
			origin: 'https://evil.test'
		});
		expect((await hub.serve(crossSite)).status).toBe(404);
		const bearer = await hub.sessions.native();
		const native = new Request(`${ORIGIN}/api/push/subscription`, {
			method: 'POST',
			headers: { authorization: `Bearer ${bearer}` },
			body: JSON.stringify(target)
		});
		expect((await hub.serve(native)).status).toBe(404);
		const saved = await hub.serve(hub.browser('POST', '/subscription', owner, { body: target }));
		const text = await saved.text();
		expect(JSON.parse(text).browsers).toHaveLength(1);
		expect(text).not.toContain(mac);
		expect(text).not.toContain(target.keys.auth);
		await hub.serve(hub.browser('POST', '/subscription', owner, { body: target }));
		const removed = await hub.serve(
			hub.browser('DELETE', '/subscription', owner, { body: { endpoint: mac } })
		);
		expect(((await removed.json()) as { browsers: unknown[] }).browsers).toEqual([]);
	} finally {
		await hub.close();
	}
});

test('stores only known push services and valid quiet hours', async () => {
	const hub = await pushHub();
	try {
		const owner = await hub.sessions.browser();
		const { target } = webPushBrowser(mac);
		for (const bad of [
			{ ...target, endpoint: 'https://attacker.test/collect' },
			{ ...target, endpoint: 'http://fcm.googleapis.com/x' },
			{ ...target, keys: { ...target.keys, auth: 'short' } }
		])
			expect(
				(await hub.serve(hub.browser('POST', '/subscription', owner, { body: bad }))).status
			).toBe(400);
		const quiet = (value: unknown) =>
			hub.serve(hub.browser('POST', '', owner, { body: { quiet: value } }));
		expect((await quiet({ enabled: true, start: '25:00', end: '08:00' })).status).toBe(400);
		const changed = await quiet({ enabled: false, start: '23:30', end: '07:15' });
		expect(((await changed.json()) as { quiet: unknown }).quiet).toEqual({
			enabled: false,
			start: '23:30',
			end: '07:15'
		});
		for (let index = 0; index < 23; index++) {
			hub.advance(1);
			const endpoint = `${mac}-${index}`;
			await hub.serve(
				hub.browser('POST', '/subscription', owner, { body: { ...target, endpoint } })
			);
		}
		const read = await (await hub.serve(hub.browser('GET', '', owner))).json();
		expect((read as { browsers: unknown[] }).browsers).toHaveLength(20);
	} finally {
		await hub.close();
	}
});

test('the sender path takes only a fresh signature of the configured key', async () => {
	const hub = await pushHub();
	try {
		const owner = await hub.sessions.browser();
		const status = async (authorization: string) =>
			(await hub.serve(hub.sender(authorization))).status;
		expect(await status(hubSenderAuthorization(hub.config, NOW))).toBe(200);
		expect(await status(hubSenderAuthorization(hub.config, NOW - 10 * 60_000))).toBe(401);
		expect(await status(hubSenderAuthorization(hub.config, NOW + 10 * 60_000))).toBe(401);
		// A computer's clock is never exactly the Hub's: half a minute either way is accepted.
		for (const drift of [-30_000, 30_000])
			expect(await status(hubSenderAuthorization(hub.config, NOW + drift)), `${drift}`).toBe(200);
		const stranger = { ...hub.config, ...generateWebPushKeys() };
		expect(await status(hubSenderAuthorization(stranger, NOW))).toBe(401);
		const elsewhere = { ...hub.config, hubOrigin: 'https://other.example.test' };
		expect(await status(hubSenderAuthorization(elsewhere, NOW))).toBe(401);
		// The token a push service receives must not open the Hub, even for the Hub's own origin.
		const vapid = vapidAuthorization(hub.config, ORIGIN + '/x', NOW);
		const token = /t=([^,]+)/.exec(vapid)![1];
		expect(await status(`Bearer ${token}`)).toBe(401);
		expect(await status(`Bearer ${owner}`)).toBe(401);
		expect(await status('')).toBe(401);
		const unset = hub.sender(hubSenderAuthorization(hub.config, NOW));
		expect((await hub.serve(unset, null)).status).toBe(404);
	} finally {
		await hub.close();
	}
});

test('the Tracker sender reaches a subscribed browser through the real Hub routes', async () => {
	const hub = await pushHub();
	const folder = mkdtempSync(join(tmpdir(), 'hub-web-push-'));
	try {
		const owner = await hub.sessions.browser();
		const device = webPushBrowser(mac);
		const gone = webPushBrowser(`${mac}-removed`);
		for (const { target } of [device, gone])
			await hub.serve(hub.browser('POST', '/subscription', owner, { body: target }));
		const file = join(folder, 'web-push.json');
		writeFileSync(file, JSON.stringify(hub.config), { mode: 0o600 });
		chmodSync(file, 0o600);
		const shown: unknown[] = [];
		const sender = new TrackerWebPushService({
			database: join(folder, 'tracker.db'),
			now: hub.clock,
			asks: () => [{ itemId: 'item-1', project: 'harbor', question: 'Ship it?' }],
			async fetch(url, init) {
				if (url.startsWith(ORIGIN)) return hub.serve(new Request(url, init));
				if (url !== mac) return new Response(null, { status: 410 });
				shown.push(device.open(Buffer.from(init.body as Uint8Array)));
				return new Response(null, { status: 201 });
			}
		});
		await sender.tick();
		expect(shown).toEqual([{ title: 'harbor needs you', body: 'Ship it?', needs: 'item-1' }]);
		const after = (await (await hub.serve(hub.browser('GET', '', owner))).json()) as {
			browsers: { deliveredAt: number | null }[];
		};
		expect(after.browsers).toEqual([{ id: expect.any(String), deliveredAt: NOW }]);
		const stored = await hub.db.prepare('SELECT * FROM web_push_subscriptions').all();
		expect(JSON.stringify(stored.results)).not.toContain('Ship it?');
	} finally {
		rmSync(folder, { recursive: true, force: true });
		await hub.close();
	}
});
