import { mkdirSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { loadTrackerNodeConfig } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeConfig';
import { trackerNodeRuntime } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeRuntime';
import { withTempDir } from '../../support/temporary';
import { measureWorkload } from '../../support/measureWorkload';

const node = 'daniel-primary-mbp';
const itemId = 'abc123def4';

test('adopts the exact legacy exit sentinel after the pane disappears and preserves its status', () =>
	measureWorkload('repository.projects-sessions-tracker-dispatch', 'legacy-exit-adoption', () =>
		withTempDir('hnt-legacy-exit-', proveLegacyExit)
	));

async function proveLegacyExit(root: string) {
	const snapshot = Date.now();
	const config = exitFixtureConfig(root);
	const database = new DatabaseSync(':memory:');
	const runtime = new TrackerNativeRuntimeService(database, {
		...trackerNodeRuntime(config),
		now: () => snapshot
	});
	const directory = join(root, 'run-9');
	const sentinel = join(directory, 'exit');
	mkdirSync(directory, { mode: 0o700 });
	const unrelated = join(root, 'unrelated');
	writeFileSync(unrelated, '0\n');
	symlinkSync(unrelated, sentinel);
	try {
		seedPriorRun(runtime, snapshot);
		const signal = new AbortController().signal;
		await runtime.scheduler!.tick(signal);
		expect(runState(database)).toEqual({ state: 'running', exit_code: null, outcome: null });
		unlinkSync(sentinel);
		writeFileSync(sentinel, '7\n', { mode: 0o600 });
		await runtime.scheduler!.tick(signal);
		expect(runState(database)).toEqual({ state: 'finished', exit_code: 7, outcome: 'failed' });
	} finally {
		database.close();
	}
}

function seedPriorRun(runtime: TrackerNativeRuntimeService, snapshot: number) {
	runtime.store.appendLocal({
		itemId,
		fields: {
			title: 'Retained work',
			kind: 'task',
			status: 'in_progress',
			project: 'Harness',
			auto: 'prior-token',
			computer: node
		}
	});
	runtime.store.database
		.prepare(
			`INSERT INTO runs
		(id,item_id,auto_token,rung,cli,model,state,queued_at,started_at,tmux,session_id)
		VALUES (9,?,'prior-token','sol','codex','gpt-6.2-sol','running',?,?,'auto-abc123-r9','provider-id')`
		)
		.run(itemId, snapshot - 5_000, snapshot - 1_000);
}

function runState(db: DatabaseSync) {
	return db.prepare('SELECT state,exit_code,outcome FROM runs WHERE id = 9').get();
}

function exitFixtureConfig(root: string) {
	const secret = join(root, 'secret');
	const driver = join(root, 'driver');
	const config = join(root, 'config.json');
	writeFileSync(secret, 'synthetic-legacy-exit-wire-secret', { mode: 0o600 });
	writeFileSync(driver, '#!/bin/sh\n[ "$1" = "inspect" ] || exit 9\nprintf "[]"\n', {
		mode: 0o700
	});
	writeFileSync(
		config,
		JSON.stringify({
			version: 1,
			node,
			role: 'hub',
			apiPort: 49281,
			syncPort: 49282,
			database: join(root, 'db'),
			legacyFenceFile: join(root, 'fence'),
			syncSecretFile: secret,
			hostEffects: {
				mode: 'active',
				checkpoint: 'fixture',
				launch: {
					driver,
					legacyRunDirectory: root,
					repositories: { Harness: { repo: root, platform: 'linux' } }
				}
			}
		}),
		{ mode: 0o600 }
	);
	return loadTrackerNodeConfig(config);
}
