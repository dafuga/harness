import { createHmac } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { TrackerSupervisorService } from '../../../src/services/projects-sessions/TrackerSupervisorService';
import { TrackerSyncAuthService } from '../../../src/services/networking-security/TrackerSyncAuthService';
import { attemptKey } from '../../../src/services/agents-providers/tracker-dispatcher-service/launchEligibility';
import { dispatchRunRows } from '../../../src/repositories/projects-sessions/tracker-dispatch-repository/dispatchRunRows';
import { loadTrackerNodeConfig } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeConfig';
import { trackerNodeApi } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeListeners';
import { trackerNodeRuntime } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeRuntime';
import { withTempRepo } from '../../support/temporary';
import type { TemporaryRepo } from '../../support/temporary.types';
import { measureWorkload } from '../../support/measureWorkload';
import { managedFixtureBindings } from '../../support/trackerManagedProcessFixture';

const itemId = 'abc123def4';
const node = 'daniel-primary-mbp';
const syncSecret = 'synthetic-host-worker-wire-key';

test('the configured foreground releases a managed Docker reservation and completes after the normal Tracker done request', () =>
	measureWorkload('service.projects-sessions-tracker-node', 'managed-foreground', () =>
		withTempRepo(proveManagedForeground)
	));

async function proveManagedForeground({ root, git }: TemporaryRepo) {
	git('commit', '--allow-empty', '-m', 'Fixture source');
	const { config, profiles } = managedFixtureBindings(root);
	const journal = join(root, 'managed.sqlite');
	let database = new DatabaseSync(journal);
	const options = trackerNodeRuntime(foregroundConfig(root, config));
	const signal = new AbortController().signal;
	try {
		const runtime = new TrackerNativeRuntimeService(database, options);
		runtime.store.appendLocal({
			itemId,
			fields: {
				title: 'Synthetic Docker work',
				status: 'open',
				kind: 'task',
				project: 'Harness',
				notes: 'Full fixture brief'
			}
		});
		expect((await itemRequest(runtime, 'launch')).status).toBe(200);
		await runtime.scheduler!.tick(signal);
		expect(database.prepare('SELECT state,tmux FROM runs').all()).toEqual([
			{ state: 'running', tmux: 'auto-abc123-r1' }
		]);
		const key = fixtureGuestKey(database);
		await verifyGuestCommands(runtime, key);
		database.close();
		database = new DatabaseSync(journal);
		const reopened = new TrackerNativeRuntimeService(database, options);
		expect((await signedCommand(reopened, [itemId, 1, 'note', 'Exactly once'], key)).status).toBe(
			200
		);
		expect((await signedCommand(reopened, [itemId, 1, 'done', 'Verified'], key)).status).toBe(200);
		await reopened.scheduler!.tick(signal);
		expect(database.prepare('SELECT state,outcome FROM runs').all()).toEqual([
			{ state: 'finished', outcome: 'done' }
		]);
		await verifyCompletedGuest(reopened, key);
		const outputs = readFileSync(join(profiles.docker, 'invoked.ndjson'), 'utf8')
			.trim()
			.split('\n');
		expect(outputs).toHaveLength(1);
		const dispatched = JSON.parse(outputs[0]);
		expect(dispatched).toMatchObject({
			brief: expect.stringContaining('tracker done abc123'),
			guestAuthFile: expect.stringMatching(/\/effects\/[a-f0-9]{64}\/guest-auth\.json$/)
		});
		expect(existsSync(dispatched.guestAuthFile)).toBe(false);
	} finally {
		database.close();
	}
}

function fixtureGuestKey(database: DatabaseSync) {
	const [run] = dispatchRunRows(database, node, itemId);
	return createHmac('sha256', syncSecret)
		.update(JSON.stringify(['harness-tracker-guest/v1', node, itemId, run.id, attemptKey(run)]))
		.digest();
}

async function verifyGuestCommands(runtime: TrackerNativeRuntimeService, key: Buffer) {
	const denied = [
		await signedCommand(runtime, [itemId, 1, 'show', null]),
		await signedCommand(runtime, ['outside001', 1, 'show', null], key),
		await signedCommand(runtime, [itemId, 2, 'note', 'Different run'], key)
	];
	expect(denied.map(({ status }) => status)).toEqual([403, 403, 403]);
	expect((await signedCommand(runtime, [itemId, 1, 'launch', null], key)).status).toBe(400);
	const before = await signedCommand(runtime, [itemId, 1, 'show', null], key);
	expect(await before.json()).toMatchObject({
		id: itemId,
		title: 'Synthetic Docker work',
		notes: 'Full fixture brief',
		run: { id: 1, state: 'running' }
	});
	const note = [itemId, 1, 'note', 'Exactly once'];
	const retries = await Promise.all([
		signedCommand(runtime, note, key),
		signedCommand(runtime, note, key)
	]);
	expect(retries.map(({ status }) => status)).toEqual([200, 200]);
}

async function verifyCompletedGuest(runtime: TrackerNativeRuntimeService, key: Buffer) {
	expect((await signedCommand(runtime, [itemId, 1, 'done', 'Verified'], key)).status).toBe(200);
	expect((await signedCommand(runtime, [itemId, 1, 'progress', 'Too late'], key)).status).toBe(409);
	const after = await signedCommand(runtime, [itemId, 1, 'show', null], key);
	const item = await after.json();
	expect(item).toMatchObject({
		status: 'done',
		notes_log: [
			{ text: 'auto-launch requested on daniel-primary-mbp' },
			{ text: 'Exactly once' },
			{ text: 'Verified' }
		]
	});
	expect(item).not.toHaveProperty('callback');
	expect(item).not.toHaveProperty('auto');
}

function signedCommand(runtime: TrackerNativeRuntimeService, command: unknown[], key?: Buffer) {
	const pathAndQuery = '/native/guest/v1';
	const method = 'POST';
	const body = JSON.stringify(command);
	const headers: Record<string, string> = key
		? {
				authorization: new TrackerSyncAuthService(key).authorizationHeader({
					method,
					pathAndQuery,
					body
				})
			}
		: {};
	return trackerNodeApi(
		new Request('http://tracker-fixture.invalid' + pathAndQuery, { method, body, headers }),
		runtime,
		new TrackerSupervisorService(runtime),
		'fixture'
	);
}

function itemRequest(runtime: TrackerNativeRuntimeService, action: string) {
	return runtime.items.handle(
		new Request(`http://tracker-fixture.invalid/items/${itemId}/${action}`, {
			method: 'POST',
			body: '{}'
		})
	);
}

function foregroundConfig(
	root: string,
	managed: ReturnType<typeof managedFixtureBindings>['config']
) {
	const path = join(root, 'foreground.json');
	const syncSecretFile = join(root, 'secret');
	writeFileSync(syncSecretFile, syncSecret, { mode: 0o600 });
	writeFileSync(
		path,
		JSON.stringify({
			version: 1,
			node,
			role: 'hub',
			apiPort: 49281,
			syncPort: 49282,
			database: join(root, 'test-db'),
			legacyFenceFile: join(root, 'fence'),
			syncSecretFile,
			hostEffects: {
				mode: 'active',
				checkpoint: 'fixture',
				launch: { managed, repositories: { Harness: { repo: root, platform: 'linux' } } }
			}
		}),
		{ mode: 0o600 }
	);
	return loadTrackerNodeConfig(path);
}
