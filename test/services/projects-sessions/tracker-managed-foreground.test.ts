import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { loadTrackerNodeConfig } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeConfig';
import { trackerNodeRuntime } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeRuntime';
import { withTempRepo } from '../../support/temporary';
import type { TemporaryRepo } from '../../support/temporary.types';
import { measureWorkload } from '../../support/measureWorkload';
import { managedFixtureBindings } from '../../support/trackerManagedProcessFixture';

const itemId = 'abc123def4';
const node = 'daniel-primary-mbp';

test('the configured foreground releases a managed Docker reservation and completes after the normal Tracker done request', () =>
	measureWorkload('service.projects-sessions-tracker-node', 'managed-foreground', () =>
		withTempRepo(proveManagedForeground)
	));

async function proveManagedForeground({ root, git }: TemporaryRepo) {
	git('commit', '--allow-empty', '-m', 'Fixture source');
	const { config, profiles } = managedFixtureBindings(root);
	const database = new DatabaseSync(':memory:');
	const signal = new AbortController().signal;
	try {
		const runtime = new TrackerNativeRuntimeService(
			database,
			trackerNodeRuntime(foregroundConfig(root, config), (scope) => {
				expect(scope).toMatchObject({ itemId, apiPort: 49281 });
				expect(JSON.parse(scope.key)).toEqual([itemId, expect.any(String), 1]);
				writeFileSync(scope.path, 'synthetic host-signer fixture', { flag: 'wx', mode: 0o600 });
			})
		);
		runtime.store.appendLocal({
			itemId,
			fields: { title: 'Synthetic Docker work', status: 'open', kind: 'task', project: 'Harness' }
		});
		expect((await itemRequest(runtime, 'launch')).status).toBe(200);
		await runtime.scheduler!.tick(signal);
		expect(database.prepare('SELECT state,tmux FROM runs').all()).toEqual([
			{ state: 'running', tmux: 'auto-abc123-r1' }
		]);
		expect((await itemRequest(runtime, 'done')).status).toBe(200);
		await runtime.scheduler!.tick(signal);
		expect(database.prepare('SELECT state,outcome FROM runs').all()).toEqual([
			{ state: 'finished', outcome: 'done' }
		]);
		const outputs = readFileSync(join(profiles.docker, 'invoked.ndjson'), 'utf8')
			.trim()
			.split('\n');
		expect(outputs).toHaveLength(1);
		const launched = JSON.parse(outputs[0]);
		expect(launched).toMatchObject({
			brief: expect.stringContaining('tracker done abc123'),
			guestAuthFile: expect.stringMatching(/\/effects\/[a-f0-9]{64}\/guest-auth\.json$/)
		});
		expect(launched.guestAuthFile.startsWith(launched.cwd + '/')).toBe(false);
		expect(existsSync(launched.guestAuthFile)).toBe(false);
		await verifyLostSession(runtime, database, config.stateDirectory);
	} finally {
		database.close();
	}
}

async function verifyLostSession(
	runtime: TrackerNativeRuntimeService,
	database: DatabaseSync,
	attempts: string
) {
	const signal = new AbortController().signal;
	expect((await itemRequest(runtime, 'reopen')).ok).toBe(true);
	expect((await itemRequest(runtime, 'unlaunch')).ok).toBe(true);
	expect((await itemRequest(runtime, 'launch')).ok).toBe(true);
	await runtime.scheduler!.tick(signal);
	const active = readdirSync(attempts).find((entry) => {
		const path = join(attempts, entry, 'receipt.json');
		return existsSync(path) && JSON.parse(readFileSync(path, 'utf8')).runId === 2;
	});
	expect(active).toBeDefined();
	const attempt = join(attempts, active!);
	unlinkSync(join(attempt, 'exit'));
	const probe = join(attempts, '..', 'tmux-presence');
	const token = readFileSync(join(attempt, 'started'), 'utf8').trim();
	for (const reply of [`HARNESS_TRACKER_ATTEMPT=${token}`, 'tmux inventory permission denied']) {
		writeFileSync(probe, reply);
		await runtime.scheduler!.tick(signal);
		expect(database.prepare('SELECT state FROM runs WHERE id = 2').get()).toEqual({
			state: 'running'
		});
	}
	unlinkSync(probe);
	await runtime.scheduler!.tick(signal);
	expect(database.prepare('SELECT state,outcome FROM runs WHERE id = 2').get()).toEqual({
		state: 'finished',
		outcome: 'abandoned'
	});
	expect((await itemRequest(runtime, 'launch')).ok).toBe(true);
	await runtime.scheduler!.tick(signal);
	expect(database.prepare('SELECT state FROM runs WHERE id = 3').get()).toEqual({
		state: 'running'
	});
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
	writeFileSync(syncSecretFile, 'synthetic-host-worker-wire-key', { mode: 0o600 });
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
				launch: {
					maxConcurrent: 1,
					managed,
					repositories: { Harness: { repo: root, platform: 'linux' } }
				}
			}
		}),
		{ mode: 0o600 }
	);
	return loadTrackerNodeConfig(path);
}
