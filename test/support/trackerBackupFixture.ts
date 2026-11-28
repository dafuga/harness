import { execFile, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { onTestFinished, vi } from 'vitest';
import { TrackerCommand } from '../../src/commands/projects-sessions/TrackerCommand';
import { trackerNodeApi } from '../../src/services/projects-sessions/tracker-node-service/trackerNodeListeners';
import { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { TrackerSupervisorService } from '../../src/services/projects-sessions/TrackerSupervisorService';
import { readChiefReview } from '../../src/repositories/projects-sessions/tracker-operation-repository/chiefReviewFields';
import { createTempDirectory } from './temporary';

const node = 'daniel-primary-mbp';

/**
 * A file-backed hub with an explicit clock and its own backup folders. `sharing` makes a
 * second hub, with another database, that writes into the first hub's backup folders.
 */
export async function trackerBackupFixture(start: string, sharing?: { external: string }) {
	const root = await createTempDirectory('tracker-backup-');
	const external = sharing?.external ?? join(root, 'backups');
	const directory = join(external, 'native');
	mkdirSync(external, { recursive: true, mode: 0o700 });
	const path = join(root, 'tracker.db');
	const database = openFixtureDatabase(root, path);
	let clock = Date.parse(start);
	const options = {
		node,
		role: 'hub' as const,
		now: () => clock,
		backup: {
			directory,
			externalDirectory: external,
			stateFile: join(root, 'tracker-backup.json')
		}
	};
	const runtime = new TrackerNativeRuntimeService(database, options);
	const append = (itemId: string, title: string) =>
		runtime.store.appendLocal({
			itemId,
			fields: { title, kind: 'task', status: 'open', created_at: start, created_by: node }
		});
	append('fixture001', 'Backed up fixture');
	return {
		root,
		directory,
		external,
		database,
		dbId: runtime.store.dbId,
		append,
		at(time: string) {
			clock = Date.parse(time);
		},
		files: () => listFiles(directory),
		alerts: () =>
			database
				.prepare("SELECT * FROM items WHERE title = 'Tracker backups need attention'")
				.all() as {
				status: string;
				needs_daniel: number;
				question: string | null;
				chief_review: string | null;
			}[],
		review: (raw: string | null) => readChiefReview(raw),
		tick: () => runWorkers(runtime),
		api: (method: string, route: string) => callApi(runtime, method, route),
		cli: (...args: string[]) => runCli(root, path, args),
		/** The shipped CLI runs on Bun, whose SQLite differs from this test runner's. */
		bunCli(...args: string[]) {
			const env = { ...process.env, HARNESS_TRACKER_CONFIG: writeNodeConfig(root, path) };
			const command = ['src/index.ts', 'tracker', ...args];
			const run = spawnSync('bun', command, { env, encoding: 'utf8' });
			return { code: run.status, out: run.stdout.trim(), err: run.stderr.trim() };
		}
	};
}

async function callApi(runtime: TrackerNativeRuntimeService, method: string, route: string) {
	const supervisor = new TrackerSupervisorService(runtime, { now: runtime.now });
	const headers = { 'x-harness-tracker-node': node, 'x-harness-tracker-role': 'hub' };
	const request = new Request('http://127.0.0.1:7700/native/v1' + route, { method, headers });
	return (await trackerNodeApi(request, runtime, supervisor, 'fixture')).json();
}

function openFixtureDatabase(root: string, path: string): DatabaseSync {
	const database = new DatabaseSync(path);
	onTestFinished(() => {
		database.close();
		rmSync(root, { recursive: true, force: true });
	});
	return database;
}

function listFiles(directory: string): string[] {
	try {
		return readdirSync(directory)
			.filter((name) => name.startsWith('tracker-'))
			.sort();
	} catch {
		return [];
	}
}

/** One supervisor pass: start the workers, let the first tick settle, then drain. */
async function runWorkers(runtime: TrackerNativeRuntimeService) {
	const controller = new AbortController();
	const supervisor = new TrackerSupervisorService(runtime, { intervalMs: 60_000 });
	const running = supervisor.run(controller.signal);
	await delay(20);
	controller.abort();
	await running;
}

function writeNodeConfig(root: string, database: string): string {
	const config = join(root, 'node.json');
	writeFileSync(
		config,
		JSON.stringify({
			version: 1,
			node,
			role: 'hub',
			apiPort: 7700,
			syncPort: 7701,
			database,
			backupDirectory: join(root, 'backups', 'native'),
			legacyFenceFile: join(root, 'fence'),
			syncSecretFile: join(root, 'secret')
		}),
		{ mode: 0o600 }
	);
	return config;
}

async function runCli(root: string, database: string, args: string[]) {
	vi.stubEnv('HARNESS_TRACKER_CONFIG', writeNodeConfig(root, database));
	const log = vi.spyOn(console, 'log').mockImplementation(() => {});
	const error = vi.spyOn(console, 'error').mockImplementation(() => {});
	try {
		const code = await new TrackerCommand().run(args);
		const text = (calls: unknown[][]) => calls.map(([line]) => String(line)).join('\n');
		return { code, out: text(log.mock.calls), err: text(error.mock.calls) };
	} finally {
		log.mockRestore();
		error.mockRestore();
		vi.unstubAllEnvs();
	}
}

// Each child opens its own database and joins the next attempt only when its peer is ready.
const concurrentBackupWriter = `
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openSqlite } from './src/adapters/development-tooling/openSqlite';
import { writeTrackerBackup } from './src/services/projects-sessions/tracker-backup-service/writeTrackerBackup';

const [root, id, peer, count] = process.argv.slice(1);
const database = openSqlite(join(root, id + '.db'));
database.exec('CREATE TABLE meta(k TEXT PRIMARY KEY, v TEXT)');
database.prepare('INSERT INTO meta VALUES (?, ?)').run('db_id', id);
const writes = [];
for (let index = 0; index < Number(count); index++) {
  writeFileSync(join(root, id + '-' + index), '');
  const ready = join(root, peer + '-' + index);
  while (!existsSync(ready)) await Bun.sleep(1);
  try {
    await writeTrackerBackup(database, join(root, 'shared-' + index), '2026-11-27');
    writes.push(index);
  } catch (error) {
    if (!String(error).includes('belongs to another database')) throw error;
  }
}
database.close();
console.log(JSON.stringify(writes));
`;

/** Distinct winner counts across fresh shared folders, one count per observed outcome. */
export async function concurrentBackupWinners(root: string): Promise<number[]> {
	const attempts = 256;
	const run = promisify(execFile);
	const writers = await Promise.all(
		[
			['first', 'second'],
			['second', 'first']
		].map(async (ids) => {
			const args = ['-e', concurrentBackupWriter, root, ...ids, String(attempts)];
			const { stdout } = await run('bun', args, { timeout: 15_000 });
			return new Set(JSON.parse(stdout) as number[]);
		})
	);
	const counts = Array.from(
		{ length: attempts },
		(_, index) => writers.filter((writer) => writer.has(index)).length
	);
	return [...new Set(counts)].sort();
}
