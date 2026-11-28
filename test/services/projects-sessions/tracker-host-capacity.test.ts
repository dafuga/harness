import {
	verifyHostLaunchOutcomes,
	verifyIdleCapacityQueue
} from '../../support/trackerLaunchOutcomeFixture';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { loadTrackerNodeConfig } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeConfig';
import { trackerNodeRuntime } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeRuntime';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { withTempDir } from '../../support/temporary';
import { measureWorkload } from '../../support/measureWorkload';
import { seedCompletedRetainedRun } from '../../support/trackerManagedProcessFixture';
import { retainedTrackerTmuxFixture } from '../../support/trackerObservedRunFixture';

const node = 'daniel-primary-mbp';
// 23:00 in Lisbon: launches and idle-work queueing run through the night.
const now = Date.parse('2026-11-25T23:00:00Z');

test('honors the host cap while retaining finished panes and reporting a flagged request', () =>
	measureWorkload(
		'service.projects-sessions-tracker-native-runtime',
		'host-capacity-at-cutover',
		() => withTempDir('hnt-cap-', proveHostCapacity)
	));

async function proveHostCapacity(root: string) {
	const db = new DatabaseSync(':memory:');
	let clock = now;
	const runtime = new TrackerNativeRuntimeService(db, {
		...trackerNodeRuntime(writeConfig(root, undefined, true)),
		now: () => clock,
		automaticEnabled: () => true
	});
	const signal = new AbortController().signal;
	const closed = join(root, 'closed');
	try {
		seedCompletedRetainedRun(runtime, db, now);
		// Someone is watching the finished pane, so it stays open and must not hold a slot.
		writeFileSync(join(root, 'attached'), '');
		for (const id of ['next100001', 'next100002', 'next100003'])
			queueCapacityItem(runtime, id, id === 'next100003');
		clock += 300_000;
		expect
			.soft(runtime.scheduler!.status().stuck.find(({ id }) => id === 'next100003'))
			.toMatchObject({ reason: 'waiting on Daniel (flagged)' });
		await runtime.scheduler!.tick(signal);
		expect
			.soft(db.prepare('SELECT item_id, state FROM runs WHERE id > 8').all())
			.toEqual([{ item_id: 'next100001', state: 'running' }]);
		expect(existsSync(closed)).toBe(false);
		await verifyHostLaunchOutcomes(runtime, db, signal);
		await verifyIdleCapacityQueue(runtime, db, signal, (elapsed) => {
			clock += elapsed;
		});
		expect(existsSync(closed)).toBe(false);
		rmSync(join(root, 'attached'));
		clock += 300_000;
		await runtime.scheduler!.tick(signal);
		expect(readFileSync(closed, 'utf8')).toContain('kill-session -t %9');
		await runtime.scheduler!.tick(signal);
		expect(db.prepare('SELECT item_id, state FROM runs WHERE id > 8').all()).toEqual([
			{ item_id: 'next100001', state: 'running' }
		]);
		expect(db.prepare("SELECT text FROM item_notes WHERE item_id = 'old008abcd'").get()).toEqual({
			text: expect.stringContaining('codex resume --all')
		});
	} finally {
		db.close();
	}
}
function queueCapacityItem(runtime: TrackerNativeRuntimeService, id: string, flagged: boolean) {
	runtime.store.appendLocal({
		itemId: id,
		actor: 'Chief of Staff',
		fields: {
			title: id,
			kind: 'task',
			status: 'open',
			project: 'Harness',
			auto: id,
			launch_source: 'manual',
			'note+': 'auto-launch requested on mac',
			computer: node,
			launch_target: node,
			...(flagged && { needs_daniel: 1, question: 'Fixture question' })
		}
	});
}

function writeConfig(
	root: string,
	dueDisk?: { freePct: number; freeGB: number },
	withTmux = false
) {
	const driver = join(root, 'driver');
	const syncSecretFile = join(root, 'secret');
	const tmux = join(root, 'tmux-fixture');
	if (withTmux)
		writeFileSync(tmux, `#!${process.execPath}\n${retainedTrackerTmuxFixture(now)}`, {
			mode: 0o700
		});
	const config = join(root, 'node.json');
	writeFileSync(driver, `#!${process.execPath}\n${driverProgram}`, { mode: 0o700 });
	writeFileSync(syncSecretFile, 'synthetic-capacity-wire-key', { mode: 0o600 });
	writeFileSync(
		config,
		JSON.stringify({
			version: 1,
			node,
			role: 'hub',
			apiPort: 49282,
			syncPort: 49283,
			database: join(root, 'db'),
			legacyFenceFile: join(root, 'fence'),
			syncSecretFile,
			hostEffects: {
				mode: 'active',
				checkpoint: 'fixture',
				...(withTmux && { watchdog: { tmux } }),
				...(dueDisk && { adapter: { driver, scheduleDue: true, dueDisk } }),
				launch: {
					driver,
					// Seven running legacy runs and one new one fill the cap. Leftover panes add nothing.
					maxConcurrent: 8,
					repositories: { Harness: { repo: root, platform: 'linux' } }
				}
			}
		}),
		{ mode: 0o600 }
	);
	return loadTrackerNodeConfig(config);
}

const driverProgram = `
const input = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
const { itemId, key, queuedAt } = input;
const legacy = Array.from({ length: 8 }, (_, index) => {
	const id = index + 1;
	const itemId = 'old00' + id;
	return { legacyRunId: id, itemId, id: 'retained-' + id, key: 'legacy:' + id,
		tmux: 'auto-' + itemId + '-r' + id, startedAt: ${now}, state: 'live' };
});
const standalone = { itemId: 'standalone', id: 'unlinked', key: 'unlinked', state: 'live', startedAt: ${now} };
const inventory = require('node:fs').existsSync(require('node:path').join(__dirname, 'tmux-fixture'))
	? [...legacy, standalone] : legacy;
const started = { itemId, key, id: 'synthetic-' + itemId, state: 'live', startedAt: queuedAt };
const fs = require('node:fs');
const receipt = require('node:path').join(__dirname, 'started');
if (process.argv[2] === 'start') fs.writeFileSync(receipt, JSON.stringify(started));
if (process.argv[2] === 'inspect' && fs.existsSync(receipt))
	inventory.push(JSON.parse(fs.readFileSync(receipt, 'utf8')));
process.stdout.write(JSON.stringify(process.argv[2] === 'inspect' ? inventory : {
	status: 'started', session: { itemId, key, id: 'synthetic-' + itemId, state: 'live', startedAt: queuedAt }
}));
`;

test('applies the designated adapter disk hold only to due work', () =>
	measureWorkload(
		'service.projects-sessions-tracker-native-runtime',
		'adapter-due-disk-scope',
		() => withTempDir('hnt-disk-', proveAdapterDueDisk)
	));

async function proveAdapterDueDisk(root: string) {
	const database = new DatabaseSync(':memory:');
	const config = writeConfig(root, { freePct: 5, freeGB: 1e12 });
	const runtime = new TrackerNativeRuntimeService(database, {
		...trackerNodeRuntime(config),
		now: () => now,
		automaticEnabled: () => true
	});
	const itemId = 'disk000001';
	const signal = new AbortController().signal;
	try {
		runtime.store.appendLocal({
			itemId,
			fields: {
				title: 'Synthetic adapter work',
				status: 'open',
				kind: 'task',
				project: 'Harness',
				auto: 'due-token',
				computer: node,
				launch_target: node,
				launch_source: 'due',
				adapter_due_owner: node,
				due: new Date(now - 60_000).toISOString()
			}
		});
		await runtime.scheduler!.tick(signal);
		expect(database.prepare('SELECT state FROM runs').all()).toEqual([]);
		expect(runtime.scheduler!.runnerStatus().waiting_on).toMatch(/disk thresholds/);
		runtime.store.appendLocal({
			itemId,
			fields: {
				auto: 'manual-token',
				launch_source: 'manual',
				'note+': 'auto-launch requested on mac'
			}
		});
		await runtime.scheduler!.tick(signal);
		expect(database.prepare('SELECT state FROM runs').all()).toEqual([{ state: 'running' }]);
	} finally {
		database.close();
	}
}
