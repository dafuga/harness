import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { loadTrackerNodeConfig } from '../../src/services/projects-sessions/tracker-node-service/trackerNodeConfig';
import { trackerNodeRuntime } from '../../src/services/projects-sessions/tracker-node-service/trackerNodeRuntime';
import { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';

const node = 'daniel-primary-mbp';
export const fixtureNow = Date.parse('2026-11-25T12:00:00Z');

/** A real node runtime over a synthetic launch driver, with optional launch and routing settings. */
export function configuredLaunchRuntime(
	root: string,
	settings: { launch?: Record<string, unknown>; routing?: Record<string, unknown> } = {}
) {
	const driver = join(root, 'driver');
	const syncSecretFile = join(root, 'secret');
	const path = join(root, 'node.json');
	writeFileSync(driver, `#!${process.execPath}\n${driverProgram}`, { mode: 0o700 });
	writeFileSync(syncSecretFile, 'synthetic-launch-wire-key', { mode: 0o600 });
	writeFileSync(
		path,
		JSON.stringify({
			version: 1,
			node,
			role: 'hub',
			apiPort: 49284,
			syncPort: 49285,
			database: join(root, 'db'),
			legacyFenceFile: join(root, 'fence'),
			syncSecretFile,
			...(settings.routing && { routing: settings.routing }),
			hostEffects: {
				mode: 'active',
				checkpoint: 'fixture',
				launch: {
					driver,
					repositories: { Harness: { repo: root, platform: 'linux' } },
					...settings.launch
				}
			}
		}),
		{ mode: 0o600 }
	);
	const database = new DatabaseSync(':memory:');
	const options = trackerNodeRuntime(loadTrackerNodeConfig(path));
	const runtime = new TrackerNativeRuntimeService(database, {
		...options,
		now: () => fixtureNow,
		automaticEnabled: () => true
	});
	return { database, runtime, options };
}

export async function launchFixtureItem(
	{ database, runtime }: ReturnType<typeof configuredLaunchRuntime>,
	id: string
) {
	runtime.store.appendLocal({
		itemId: id,
		fields: {
			title: 'Add the synthetic export view',
			kind: 'task',
			status: 'open',
			project: 'Harness',
			auto: id,
			launch_source: 'manual',
			'note+': 'auto-launch requested on mac',
			computer: node,
			launch_target: node
		}
	});
	await runtime.scheduler!.tick(new AbortController().signal);
	return database
		.prepare('SELECT rung, model, effort, reason, eta_at FROM runs WHERE item_id = ?')
		.get(id);
}

export function seedFailedRuns(database: DatabaseSync, rung: string) {
	const insert = database.prepare(
		`INSERT INTO runs (item_id, auto_token, attempt, rung, cli, model, kind, project, pinned,
			state, outcome, queued_at, started_at, ended_at)
		VALUES (?, ?, 1, ?, 'claude', 'claude-sonnet-5-5', 'feature', 'Harness', 0,
			'finished', 'failed', ?, ?, ?)`
	);
	for (const id of ['hist000001', 'hist000002', 'hist000003']) {
		const at = fixtureNow - 3_600_000;
		insert.run(id, id, rung, at, at, at);
	}
}

const driverProgram = `
const fs = require('node:fs');
const receipt = require('node:path').join(__dirname, 'started');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const sessions = fs.existsSync(receipt) ? JSON.parse(fs.readFileSync(receipt, 'utf8')) : [];
if (process.argv[2] === 'inspect') process.stdout.write(JSON.stringify(sessions));
else {
	const { itemId, key, queuedAt } = input;
	const session = { itemId, key, id: 'synthetic-' + itemId, state: 'live', startedAt: queuedAt, selection: input.selection };
	fs.writeFileSync(receipt, JSON.stringify([...sessions, session]));
	process.stdout.write(JSON.stringify({ status: 'started', session }));
}
`;
