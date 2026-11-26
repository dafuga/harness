import { DatabaseSync } from 'node:sqlite';
import { test, vi } from 'vitest';
import { expect } from '../../verificationExpect';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import type { TrackerSpokeTransport } from '../../../src/services/projects-sessions/TrackerSpokeSyncService.types';
import { TrackerSyncAuthService } from '../../../src/services/networking-security/TrackerSyncAuthService';
import { primary, secondary } from '../../support/trackerDispatcherFixture';
import { fixtureSecret, wire } from '../../support/trackerDispatchQueueFixture';

const signal = new AbortController().signal;
const now = () => Date.parse('2026-11-25T12:00:00Z');

function mac(node: string, links: { link: 'hub' | 'peer'; transport: TrackerSpokeTransport }[]) {
	const database = new DatabaseSync(':memory:');
	const runtime = new TrackerNativeRuntimeService(database, {
		node,
		role: 'spoke',
		now,
		syncResponder: { auth: new TrackerSyncAuthService(fixtureSecret) },
		links: links.map((link) => ({ ...link, secret: fixtureSecret, pullWaitSeconds: 0 }))
	});
	const finished = (id: number, itemId: string) =>
		database
			.prepare(
				`INSERT INTO runs (id, item_id, auto_token, attempt, rung, cli, model, state, outcome, queued_at, started_at, ended_at)
				VALUES (?, ?, ?, 1, 'sonnet', 'claude', 'claude-sonnet-5-5', 'finished', 'done', ?, ?, ?)`
			)
			.run(id, itemId, `token-${itemId}`, now() - 3000, now() - 2000, now() - 1000);
	const history = () =>
		database.prepare('SELECT node, item_id FROM remote_runs ORDER BY node, item_id').all();
	return { database, runtime, finished, history };
}

const down: TrackerSpokeTransport = async () => {
	throw new Error('fixture hub outage');
};

test('two Macs exchange run history over the peer link while the hub is down', async () => {
	const other = mac(secondary, [{ link: 'hub', transport: down }]);
	const local = mac(primary, [
		{ link: 'hub', transport: down },
		{ link: 'peer', transport: wire(other.runtime.sync!) }
	]);
	try {
		local.finished(1, 'local00001');
		other.finished(1, 'other00001');
		await expect(local.runtime.telemetry!(signal)).rejects.toThrow('fixture hub outage');
		expect(other.history()).toEqual([{ node: primary, item_id: 'local00001' }]);
		expect(local.history()).toEqual([{ node: secondary, item_id: 'other00001' }]);
	} finally {
		local.database.close();
		other.database.close();
	}
});

test('a hub that never answers does not delay the peer exchange', async () => {
	const other = mac(secondary, [{ link: 'hub', transport: down }]);
	let release!: (error: Error) => void;
	const hung = new Promise<never>((_resolve, reject) => (release = reject));
	const local = mac(primary, [
		{ link: 'hub', transport: () => hung },
		{ link: 'peer', transport: wire(other.runtime.sync!) }
	]);
	try {
		local.finished(1, 'local00001');
		const tick = local.runtime.telemetry!(signal);
		await vi.waitFor(() =>
			expect(other.history()).toEqual([{ node: primary, item_id: 'local00001' }])
		);
		release(new Error('fixture hub gave up'));
		await expect(tick).rejects.toThrow('fixture hub gave up');
	} finally {
		local.database.close();
		other.database.close();
	}
});

test('fleet status keeps the hub samples when the peer reports none', async () => {
	const other = mac(secondary, [{ link: 'hub', transport: down }]);
	const sample = { node: 'grok-box', at: new Date(now()).toISOString() };
	const local = mac(primary, [
		{ link: 'hub', transport: async () => ({ ok: true, machines: [sample] }) },
		{ link: 'peer', transport: wire(other.runtime.sync!) }
	]);
	try {
		await local.runtime.telemetry!(signal);
		expect(local.runtime.fleetSamples!()).toEqual([sample]);
	} finally {
		local.database.close();
		other.database.close();
	}
});
