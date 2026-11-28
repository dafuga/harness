import { proveTrackerTmuxRecovery, tmuxExecutable } from './support/trackerRecoveryFixture';
import { existsSync, realpathSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { TrackerDispatchRepository } from '../src/repositories/projects-sessions/TrackerDispatchRepository';
import { TrackerPersistenceService } from '../src/services/projects-sessions/TrackerPersistenceService';
import { once } from 'node:events';
import { connect, createServer } from 'node:net';
import { expect, test } from 'vitest';
import { measureWorkload } from './support/measureWorkload';
import { notificationSink, proveForegroundSync } from './support/trackerNodeAssertions';
import {
	fixtureConfig,
	fixtureTrackerJson,
	finishedTrackerProcess,
	freeTrackerPorts,
	loopback,
	serveTrackerArgs,
	startTrackerFixture,
	trackerFixtureFiles,
	writeTrackerFence,
	writeTrackerFixture
} from './support/trackerNodeProcess';
import type { TrackerNodeFixture } from './support/trackerNodeProcess.types';
import { withTempDir } from './support/temporary';
import { verifyTrackerRollback } from './support/verifyTrackerRollback';
import { proveTrackerJobCommands } from './support/trackerBoxJobCli';
import { proveTrackerHygieneCloseout } from './support/trackerNodeHygiene';

test(
	'a launched Tracker CLI requires and saves its hygiene attestation',
	proveTrackerHygieneCloseout,
	40_000
);

test('foreground hub and spoke converge over signed loopback and route compatibility commands and notifications', async () => {
	await withTempDir('hnt-', async (temporary) => {
		const root = realpathSync(temporary);
		trackerFixtureFiles(root);
		const [hubApi, spokeApi, hubSync, callbackPort] = await freeTrackerPorts(4);
		const sink = await notificationSink(callbackPort);
		const hub = writeTrackerFixture(root, {
			...fixtureConfig(root, 'synthetic-hub', hubApi),
			role: 'hub',
			syncPort: hubSync,
			notifications: {
				targets: { cos: { url: sink.base + '/cos' } },
				chiefOfStaff: 'cos'
			}
		});
		const spoke = writeTrackerFixture(root, {
			...fixtureConfig(root, 'synthetic-spoke', spokeApi),
			role: 'spoke',
			upstream: { url: loopback(hubSync) },
			hostEffects: {
				mode: 'active',
				checkpoint: 'fixture-migration-01',
				watchdog: { transcriptRoots: [join(root, 'fixture-transcripts')] }
			},
			notifications: {
				targets: { callback: { url: sink.base + '/callback' } },
				itemCallbacks: ['callback']
			}
		});
		try {
			await measureWorkload(
				'service.projects-sessions-tracker-node',
				'signed-spoke-model-pin',
				() => {
					seedSpokeRun(spoke);
					return proveForegroundSync(hub, spoke, hubSync, sink);
				}
			);
		} finally {
			await sink.close();
		}
		expect(existsSync(join(root, 'legacy-used'))).toBe(false);
	});
}, 70_000);

function seedSpokeRun({ config }: TrackerNodeFixture) {
	const database = new DatabaseSync(config.database);
	try {
		const store = new TrackerPersistenceService(database, config.node);
		new TrackerDispatchRepository(store);
		store.appendLocal({
			itemId: 'spokerun22',
			fields: {
				title: 'Synthetic running spoke item',
				status: 'in_progress',
				kind: 'task',
				auto: 'spoke-token'
			}
		});
		const now = Date.now();
		database
			.prepare(
				`INSERT INTO runs (id, item_id, auto_token, rung, cli, model, state, queued_at, started_at)
			VALUES (22, 'spokerun22', 'spoke-token', 'sol', 'codex', 'gpt-6.2-sol', 'running', ?, ?)`
			)
			.run(now, now);
	} finally {
		database.close();
	}
}

test('startup refuses an unfenced role or competing API, sync or journal owner and releases its lease on stop', async () => {
	await withTempDir('hnt-', async (temporary) => {
		const root = realpathSync(temporary);
		trackerFixtureFiles(root);
		const [api, sync, otherApi, otherSync] = await freeTrackerPorts(4);
		const hub = writeTrackerFixture(root, {
			...fixtureConfig(root, 'fenced-hub', api),
			role: 'hub',
			syncPort: sync
		});
		const args = serveTrackerArgs(hub);
		unlinkSync(hub.config.legacyFenceFile);
		expect((await finishedTrackerProcess(hub, args)).code).toBe(1);
		expect(existsSync(hub.config.database + '.supervisor-lock.sqlite')).toBe(false);
		writeTrackerFence(hub.config);
		expect((await finishedTrackerProcess(hub, [...args.slice(0, -1), 'spoke'])).code).toBe(2);
		const owner = await startTrackerFixture(hub);
		const id = await verifyCompetingOwners(root, hub, otherApi, otherSync).finally(() =>
			owner.stop()
		);
		await verifyTrackerRollback(root, hub, id);
		const restarted = await startTrackerFixture(hub);
		try {
			expect(await fixtureTrackerJson(hub, ['show', id])).toMatchObject({
				id,
				notes_log: [{ text: 'Native note visible after rollback' }]
			});
		} finally {
			expect((await restarted.stop()).code).toBe(0);
		}
		expect(existsSync(join(root, 'legacy-used'))).toBe(false);
	});
}, 25_000);

test('the hub CLI manages box jobs and a spoke is refused', proveTrackerJobCommands, 40_000);

async function verifyCompetingOwners(
	root: string,
	hub: TrackerNodeFixture,
	api: number,
	sync: number
) {
	const { id } = await fixtureTrackerJson(hub, ['add', 'Lease fixture survives native restart']);
	await fixtureTrackerJson(hub, ['note', id, 'Native note visible after rollback']);
	for (const collision of [
		{ apiPort: hub.config.apiPort, syncPort: sync },
		{ apiPort: api, syncPort: 'syncPort' in hub.config ? hub.config.syncPort : sync },
		{ apiPort: api, syncPort: sync, database: hub.config.database }
	]) {
		const second = writeTrackerFixture(root, {
			...fixtureConfig(root, 'other-hub', api),
			role: 'hub',
			...collision
		});
		expect((await finishedTrackerProcess(second, serveTrackerArgs(second))).code).toBe(1);
	}
	expect(await fixtureTrackerJson(hub, ['status'])).toMatchObject({
		node: 'fenced-hub',
		role: 'hub'
	});
	return id;
}

test('the candidate claims the standalone supervisor socket and refuses a listening predecessor', async () => {
	await withTempDir('hnt-', async (temporary) => {
		const root = realpathSync(temporary);
		trackerFixtureFiles(root);
		const [apiPort, syncPort] = await freeTrackerPorts(2);
		const socket = join(root, 'legacy.sock');
		const fixture = writeTrackerFixture(root, {
			...fixtureConfig(root, 'socket-hub', apiPort),
			role: 'hub',
			syncPort,
			legacySupervisorSocket: socket
		});
		const incumbent = createServer((connection) => connection.end('synthetic-predecessor\n'));
		incumbent.listen(socket);
		await once(incumbent, 'listening');
		try {
			expect((await finishedTrackerProcess(fixture, serveTrackerArgs(fixture))).code).toBe(1);
			expect(await readSupervisorSocket(socket)).toBe('synthetic-predecessor');
		} finally {
			await new Promise<void>((resolve) => incumbent.close(() => resolve()));
		}
		const owner = await startTrackerFixture(fixture);
		try {
			expect(await readSupervisorSocket(socket)).toBe(String(owner.ready.pid));
		} finally {
			expect((await owner.stop()).code).toBe(0);
		}
		expect(existsSync(socket)).toBe(false);
	});
}, 20_000);

async function readSupervisorSocket(path: string): Promise<string> {
	const socket = connect(path);
	socket.setTimeout(4_000, () =>
		socket.destroy(new Error('Synthetic supervisor socket timed out'))
	);
	try {
		const chunks: Buffer[] = [];
		for await (const chunk of socket) chunks.push(chunk);
		return Buffer.concat(chunks).toString().trim();
	} finally {
		socket.destroy();
	}
}

test.skipIf(process.platform !== 'darwin' || !tmuxExecutable)(
	'relaunches a killed managed tmux session and flags after three failed recoveries',
	{ timeout: 40_000 },
	proveTrackerTmuxRecovery
);
