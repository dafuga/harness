import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { loadTrackerNodeConfig } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeConfig';
import { trackerNodeRuntime } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeRuntime';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { withTempDir } from '../../support/temporary';
import { measureWorkload } from '../../support/measureWorkload';

const node = 'daniel-primary-mbp';
const now = 1_800_000_000_000;

test('honors the configured host cap during a migrated eight-session startup', () =>
	measureWorkload(
		'service.projects-sessions-tracker-native-runtime',
		'host-capacity-at-cutover',
		() =>
			withTempDir('hnt-cap-', async (root) => {
				const db = new DatabaseSync(':memory:');
				const runtime = new TrackerNativeRuntimeService(db, {
					...trackerNodeRuntime(writeConfig(root)),
					now: () => now
				});
				try {
					for (let id = 1; id <= 8; id++) {
						db.prepare(
							`INSERT INTO runs(id,item_id,auto_token,rung,cli,model,state,queued_at,started_at,tmux)
						VALUES (?,?,'legacy','sol','codex','gpt-6.2-sol','running',?,?,?)`
						).run(id, 'old00' + id + 'abcd', now, now, 'auto-old00' + id + '-r' + id);
					}
					for (const itemId of ['next100001', 'next100002'])
						runtime.store.appendLocal({
							itemId,
							fields: {
								title: itemId,
								kind: 'task',
								status: 'open',
								project: 'Harness',
								auto: itemId,
								computer: node,
								launch_target: node
							}
						});
					const signal = new AbortController().signal;
					await runtime.scheduler!.tick(signal);
					await runtime.scheduler!.tick(signal);
					expect(
						db.prepare("SELECT count(*) AS n FROM meta WHERE k LIKE 'harness_dispatch_run:%'").get()
					).toEqual({ n: 9 });
					expect(
						db.prepare('SELECT item_id, state FROM runs WHERE id > 8 ORDER BY id').all()
					).toEqual([{ item_id: 'next100001', state: 'running' }]);
				} finally {
					db.close();
				}
			})
	));

function writeConfig(root: string, dueDisk?: { freePct: number; freeGB: number }) {
	const driver = join(root, 'driver');
	const syncSecretFile = join(root, 'secret');
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
				...(dueDisk && { adapter: { driver, scheduleDue: true, dueDisk } }),
				launch: {
					driver,
					maxConcurrent: 9,
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
process.stdout.write(JSON.stringify(process.argv[2] === 'inspect' ? legacy : {
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
		now: () => now
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
			fields: { auto: 'manual-token', launch_source: 'manual' }
		});
		await runtime.scheduler!.tick(signal);
		expect(database.prepare('SELECT state FROM runs').all()).toEqual([{ state: 'running' }]);
	} finally {
		database.close();
	}
}
