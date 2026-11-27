import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test, vi } from 'vitest';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import {
	loadTrackerNodeConfig,
	verifyTrackerLegacyFence
} from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeConfig';
import { trackerNodeRuntime } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeRuntime';
import { measureWorkload } from '../../support/measureWorkload';
import { withTempDir } from '../../support/temporary';

const unit = 'service.projects-sessions-tracker-node';
const now = () => 1_800_000_000_000;
const signal = new AbortController().signal;
const dockerId = 'docker1234';
const macId = 'macos12345';

test('configured dispatch adopts an uncertain process exactly once and completes through Tracker done', () =>
	measureWorkload(unit, 'foreground-host-launch-adoption', () =>
		withTempDir('hnt-host-', proveHostLaunch)
	));

test('held or unfenced configuration launches no host workers', () =>
	measureWorkload(unit, 'foreground-host-effect-fence', () =>
		withTempDir('hnt-hold-', (root) => {
			const fixture = hostFixture(root);
			const held = fixture.load({ mode: 'held' });
			const db = new DatabaseSync(':memory:');
			try {
				const runtime = new TrackerNativeRuntimeService(db, trackerNodeRuntime(held));
				expect(runtime.scheduler).toBeUndefined();
				expect(runtime.notifications).toBeUndefined();
				expect(runtime.adapter).toBeUndefined();
				const active = fixture.load(fixture.effects);
				expect(() => verifyTrackerLegacyFence(active)).toThrow(/host effects/i);
				expect(readFileSync(fixture.trace, 'utf8')).toBe('');
			} finally {
				db.close();
			}
		})
	));

async function proveHostLaunch(root: string) {
	const fixture = hostFixture(root);
	const config = fixture.load(fixture.effects, true);
	expect(verifyTrackerLegacyFence(config)).toBe('fixture-fence');
	const path = join(root, 'journal.sqlite');
	let db = new DatabaseSync(path);
	const runtime = () => new TrackerNativeRuntimeService(db, { ...trackerNodeRuntime(config), now });
	const initial = runtime();
	try {
		for (const [itemId, project] of [
			[dockerId, 'Harness'],
			[macId, 'Xcode']
		]) {
			initial.store.appendLocal({
				itemId,
				fields: { title: project, kind: 'task', project, status: 'open' }
			});
			expect((await request(initial, itemId, 'launch')).ok).toBe(true);
		}
		expect(initial.scheduler).toBeDefined();
		await expect(initial.scheduler!.tick(signal)).resolves.toBeUndefined();
		expect(runState(db, dockerId)).toMatchObject({ state: 'queued' });
		expect(runState(db, macId)?.state).toBe('running');
		db.close();
		db = new DatabaseSync(path);
		const resumed = runtime();
		await verifyResumedHost(resumed, db, fixture.trace);
		await verifyNewLaunch(resumed, db);
	} finally {
		db.close();
	}
}

async function verifyResumedHost(
	runtime: TrackerNativeRuntimeService,
	db: DatabaseSync,
	trace: string
) {
	await runtime.scheduler!.tick(signal);
	expect(runState(db, dockerId)).toMatchObject({
		state: 'running',
		session_id: 'session-docker1234'
	});
	expect(runState(db, macId)).toMatchObject({ state: 'running', session_id: 'session-macos12345' });
	expect((await request(runtime, dockerId, 'done')).ok).toBe(true);
	await runtime.scheduler!.tick(signal);
	expect(runState(db, dockerId)).toMatchObject({ state: 'finished', outcome: 'done' });
	expect(runState(db, macId)).toMatchObject({ state: 'running', outcome: null });
	const starts = readFileSync(trace, 'utf8')
		.trim()
		.split('\n')
		.map((line) => JSON.parse(line));
	expect(starts).toMatchObject([
		{ itemId: dockerId, platform: 'linux', backend: 'docker', secretInherited: false },
		{ itemId: macId, platform: 'macos', backend: 'native', secretInherited: false }
	]);
	expect(starts[0].brief).toMatch(/tracker done docker[\s\S]+only as the final step/);
}

async function verifyNewLaunch(runtime: TrackerNativeRuntimeService, db: DatabaseSync) {
	expect((await request(runtime, macId, 'done')).ok).toBe(true);
	await runtime.scheduler!.tick(signal);
	for (const id of [dockerId, macId]) {
		const previous = db.prepare('SELECT auto_token FROM runs WHERE item_id = ?').get(id);
		expect((await request(runtime, id, 'reopen')).ok).toBe(true);
		const relaunched = await (await request(runtime, id, 'launch')).json();
		expect(relaunched.auto).toEqual(expect.any(String));
		expect.soft(relaunched.auto).not.toBe(previous?.auto_token);
	}
	await runtime.scheduler!.tick(signal);
	await runtime.scheduler!.tick(signal);
	expect(
		db.prepare('SELECT item_id, attempt FROM runs WHERE id > 2 ORDER BY item_id').all()
	).toEqual([
		{ item_id: dockerId, attempt: 1 },
		{ item_id: macId, attempt: 1 }
	]);
}

function request(runtime: TrackerNativeRuntimeService, id: string, action: string) {
	return runtime.items.handle(
		new Request(`http://tracker-fixture.invalid/items/${id}/${action}`, {
			method: 'POST',
			body: '{}'
		})
	);
}

function runState(db: DatabaseSync, id: string) {
	return db.prepare('SELECT state, outcome, session_id FROM runs WHERE item_id = ?').get(id);
}

function hostFixture(root: string) {
	for (const project of ['harness', 'xcode']) mkdirSync(join(root, project));
	const driver = join(root, 'driver');
	const trace = join(root, 'starts.ndjson');
	writeFileSync(driver, `#!${process.execPath}\n${fixtureDriver}`, { mode: 0o700 });
	writeFileSync(trace, '', { mode: 0o600 });
	writeFileSync(join(root, 'secret'), 'fixture-sync-secret-for-host-effects', { mode: 0o600 });
	const config = {
		version: 1,
		node: 'daniel-primary-mbp',
		role: 'hub',
		apiPort: 49281,
		syncPort: 49282,
		database: join(root, 'journal.sqlite'),
		legacyFenceFile: join(root, 'fence.json'),
		syncSecretFile: join(root, 'secret'),
		notifications: {
			targets: { cos: { url: 'http://127.0.0.1:1/fixture' } },
			chiefOfStaff: 'cos'
		}
	};
	const effects = {
		mode: 'active',
		checkpoint: 'fixture-fence',
		launch: {
			driver,
			repositories: {
				Harness: { repo: join(root, 'harness'), platform: 'linux' },
				Xcode: { repo: join(root, 'xcode'), platform: 'macos' }
			}
		}
	};
	const load = (hostEffects: object, fenceEffects = false) => {
		const { version, node, role, database, apiPort, syncPort } = config;
		writeFileSync(
			config.legacyFenceFile,
			JSON.stringify({
				version,
				node,
				role,
				database,
				apiPort,
				syncPort,
				checkpoint: 'fixture-fence',
				legacyAutostart: 'disabled',
				...(fenceEffects && { hostEffects: true })
			}),
			{ mode: 0o600 }
		);
		const path = join(root, 'node.json');
		writeFileSync(path, JSON.stringify({ ...config, hostEffects }), { mode: 0o600 });
		return loadTrackerNodeConfig(path);
	};
	return { effects, load, trace };
}

const fixtureDriver = `
const { appendFileSync, readFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const operation = process.argv[2];
const input = JSON.parse(readFileSync(0, 'utf8'));
const trace = join(dirname(process.argv[1]), 'starts.ndjson');
const starts = () => readFileSync(trace, 'utf8').trim().split('\\n').filter(Boolean).map(JSON.parse);
if (operation === 'inspect') {
	process.stdout.write(JSON.stringify(starts().map(({ session }) => session)));
} else if (operation === 'start') {
	const { itemId, key, platform, backend, brief, queuedAt } = input;
	const retry = starts().some((entry) => entry.itemId === itemId);
	const id = 'session-' + itemId + (retry ? '-relaunch' : '');
	const session = { itemId, key, id, state: 'live', startedAt: queuedAt };
	appendFileSync(trace, JSON.stringify({
		itemId, platform, backend, brief, session, secretInherited: Boolean(process.env.FIXTURE_TRACKER_SECRET)
	}) + '\\n');
	if (itemId === 'docker1234' && !retry) process.exit(1);
	process.stdout.write(JSON.stringify({ status: 'started', session }));
} else {
	process.exit(2);
}
`;

vi.stubEnv('FIXTURE_TRACKER_SECRET', 'synthetic sentinel');
