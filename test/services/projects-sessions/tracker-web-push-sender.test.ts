import { DatabaseSync } from 'node:sqlite';
import { chmodSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, onTestFinished, test } from 'vitest';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { createTempDirectory } from '../../support/temporary';
import { trackerWebPushFixture as fixture } from '../../support/trackerWebPushFixture';
import { macPush as mac, phonePush as phone } from '../../support/trackerWebPushWorld';

const minute = 60_000;

test('stays silent until set up, and with only pings open never asks the Hub', async () => {
	const f = await fixture();
	await f.ask('Ship it', 'Deploy now?');
	await f.tick();
	expect(f.world.hubRequests).toEqual([]);
	const quiet = await fixture();
	quiet.configure();
	await quiet.dependency('Blocked elsewhere');
	await quiet.tick();
	expect(quiet.world.hubRequests).toEqual([]);
});

test('announces a new decision once, repeats every 15 minutes, stops when answered', async () => {
	const f = await fixture();
	f.configure();
	const id = await f.ask('Ship it', 'Deploy now?', {}, 'tracker-run-40@fixture-mac');
	await f.tick();
	expect(f.world.hubRequests).toEqual([]);
	await f.api(`/items/${id}/release`, {
		question: 'Deploy now?',
		options: [{ label: 'Yes', recommended: true }, { label: 'No' }]
	});
	await f.tick();
	expect(f.world.shown).toEqual(
		[mac, phone].map((endpoint) => ({
			endpoint,
			message: { title: 'harbor needs you', body: 'Deploy now?', needs: id }
		}))
	);
	expect(f.world.hubRequests.at(-1)).toEqual({
		method: 'POST',
		body: { delivered: [mac, phone], gone: [] }
	});
	for (const step of [5_000, 14 * minute]) {
		f.advance(step);
		await f.tick();
	}
	expect(f.world.shown).toHaveLength(2);
	f.advance(minute);
	await f.tick();
	expect(f.world.shown).toHaveLength(4);
	await f.api(`/items/${id}/answer`, { option: 1, by: 'Daniel' });
	f.advance(60 * minute);
	const before = f.world.hubRequests.length;
	await f.tick();
	expect(f.world.shown).toHaveLength(4);
	expect(f.world.hubRequests).toHaveLength(before);
});

test('a second decision sends one summary of both after the one-minute spacing', async () => {
	const f = await fixture();
	f.configure();
	f.world.subscribed = 1;
	await f.ask('Ship it', 'Deploy now?');
	await f.tick();
	f.advance(2 * minute);
	await f.ask('Pay it', 'Buy the plan?', { agent: 'rng' });
	await f.tick();
	expect(f.world.shown.at(-1)?.message).toEqual({
		title: '2 decisions need you',
		body: 'harbor: Deploy now?\nrng: Buy the plan?',
		needs: 'all'
	});
	expect(f.world.shown).toHaveLength(2);
});

test('holds through quiet hours, sends at 08:00, and survives a restart', async () => {
	const f = await fixture();
	f.configure();
	f.world.subscribed = 1;
	f.at('2026-11-26T23:00:00Z');
	await f.ask('Ship it', 'Deploy now?');
	await f.tick();
	f.at('2026-11-27T07:59:00Z');
	await f.tick();
	expect(f.world.shown).toEqual([]);
	f.at('2026-11-27T08:00:00Z');
	await f.tick();
	expect(f.world.shown).toHaveLength(1);
	const state = join(f.root, 'web-push-state.json');
	expect(statSync(state).mode & 0o777).toBe(0o600);
	expect(JSON.parse(readFileSync(state, 'utf8')).lastSentAt).toBe(
		Date.parse('2026-11-27T08:00:00Z')
	);
});

test('drops a gone browser, retries a failing push service and picks up a new browser', async () => {
	const f = await fixture();
	f.configure();
	f.world.subscribed = 0;
	await f.ask('Ship it', 'Deploy now?');
	await f.tick();
	expect(f.world.shown).toEqual([]);
	f.world.subscribed = 2;
	f.world.status.set(mac, 410);
	f.world.status.set(phone, 500);
	f.advance(minute);
	await f.tick();
	expect(f.world.hubRequests.at(-1)?.body).toEqual({ delivered: [], gone: [mac] });
	f.world.subscribed = 2;
	f.world.status.delete(phone);
	f.advance(minute);
	await f.tick();
	expect(f.world.shown.map(({ endpoint }) => endpoint)).toEqual([phone]);
});

test('never reads a key file other users can read, and its error repeats nothing', async () => {
	const f = await fixture();
	f.configure();
	chmodSync(join(f.root, 'web-push.json'), 0o644);
	await f.ask('Ship it', 'Deploy now?');
	await expect(f.tick()).rejects.toThrow('Invalid or unreadable web-push.json');
	expect(f.world.hubRequests).toEqual([]);
});

test('a parked or sensitive decision is not announced', async () => {
	const f = await fixture();
	f.configure();
	await f.ask('Private', 'Private question?', { sensitive: true });
	const parked = await f.ask('Later', 'Park me?');
	f.runtime.store.appendLocal({
		itemId: parked,
		fields: { parked_until: '2026-11-30T08:00:00.000Z' }
	});
	await f.tick();
	expect(f.world.hubRequests).toEqual([]);
});

test('a spoke never notifies', async () => {
	const root = await createTempDirectory('tracker-web-push-spoke-');
	const database = new DatabaseSync(join(root, 'tracker.db'));
	onTestFinished(() => database.close());
	const runtime = new TrackerNativeRuntimeService(database, {
		node: 'harbor-mbp-2',
		role: 'spoke',
		webPush: { database: join(root, 'tracker.db') }
	});
	expect(runtime.webPush).toBeUndefined();
});

test('never repeats early when the state file cannot be written', async () => {
	const f = await fixture();
	f.configure();
	f.world.subscribed = 1;
	// A folder where the state file belongs makes every write fail.
	mkdirSync(join(f.root, 'web-push-state.json'));
	await f.ask('Ship it', 'Deploy now?');
	await expect(f.tick()).rejects.toThrow();
	for (let tick = 0; tick < 3; tick++) {
		f.advance(5_000);
		await f.tick().catch(() => {});
	}
	expect(f.world.shown).toHaveLength(1);
});
