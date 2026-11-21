import { readFileSync, writeFileSync } from 'node:fs';
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
			trackerNodeRuntime(foregroundConfig(root, config))
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
		expect(JSON.parse(outputs[0]).brief).toContain('tracker done abc123');
	} finally {
		database.close();
	}
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
				launch: { managed, repositories: { Harness: { repo: root, platform: 'linux' } } }
			}
		}),
		{ mode: 0o600 }
	);
	return loadTrackerNodeConfig(path);
}
