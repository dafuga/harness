import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, onTestFinished, vi } from 'vitest';
import { trackerNodeApi } from '../../src/services/projects-sessions/tracker-node-service/trackerNodeListeners';
import { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { TrackerSupervisorService } from '../../src/services/projects-sessions/TrackerSupervisorService';
import { fixturePolicy, primary } from './trackerDispatcherFixture';
import { createTempDirectory } from './temporary';
import { TrackerCommand } from '../../src/commands/projects-sessions/TrackerCommand';

export const fixtureTime = '2026-11-21T12:00:00.000Z';
export const fixtureItem = 'taskfixture';
export const fixtureTitle = 'Verify fixture CLI release';

export async function compatibilityFixture(configureDispatch = true) {
	const directory = await createTempDirectory('tracker-cli-compat-');
	const database = new DatabaseSync(':memory:');
	onTestFinished(() => {
		database.close();
		rmSync(directory, { recursive: true, force: true });
	});
	const node = { node: primary, role: 'hub' as const };
	stubTrackerConfig(directory, node);
	const now = () => Date.parse(fixtureTime);
	const runner = { start: vi.fn(), observe: vi.fn() };
	const options = {
		...node,
		now,
		backupDirectory: directory,
		...(configureDispatch && {
			dispatch: {
				policy: fixturePolicy(now),
				scheduleDue: true,
				runner,
				due: () => ({ enabled: true, paused: false })
			}
		})
	};
	const runtime = new TrackerNativeRuntimeService(database, options);
	seedItem(runtime);
	return {
		directory,
		database,
		runtime,
		runner,
		route: stubNativeRoute(runtime),
		run: observeCommand()
	};
}

function stubTrackerConfig(directory: string, node: { node: string; role: 'hub' }): void {
	const config = join(directory, 'tracker.json');
	vi.stubEnv('HARNESS_TRACKER_CONFIG', config);
	vi.stubEnv('TRACKER_AS', 'fixture-default');
	writeFileSync(
		config,
		JSON.stringify({
			...node,
			version: 1,
			apiPort: 7700,
			syncPort: 7701,
			database: join(directory, 'tracker.db'),
			legacyFenceFile: join(directory, 'fence'),
			syncSecretFile: join(directory, 'secret')
		}),
		{ mode: 0o600 }
	);
}

function seedItem(runtime: TrackerNativeRuntimeService): void {
	runtime.store.appendLocal({
		itemId: fixtureItem,
		fields: {
			title: fixtureTitle,
			kind: 'task',
			status: 'open',
			created_at: fixtureTime,
			created_by: primary,
			due: '2026-11-21',
			project: 'harness'
		}
	});
}

function stubNativeRoute(runtime: TrackerNativeRuntimeService) {
	const supervisor = new TrackerSupervisorService(runtime, { now: runtime.now });
	const route = vi.fn(async (url: string, init: RequestInit) => {
		expect(url).toMatch(/^http:\/\/127\.0\.0\.1:7700\/native\/v1\//);
		return trackerNodeApi(new Request(url, init), runtime, supervisor, 'fixture');
	});
	vi.stubGlobal('fetch', route);
	onTestFinished(() => {
		vi.unstubAllGlobals();
	});
	return route;
}

function observeCommand() {
	const log = vi.spyOn(console, 'log').mockImplementation(() => {});
	const error = vi.spyOn(console, 'error').mockImplementation(() => {});
	onTestFinished(() => {
		log.mockRestore();
		error.mockRestore();
		vi.unstubAllEnvs();
	});
	return async (...args: string[]) => {
		log.mockClear();
		error.mockClear();
		const code = await new TrackerCommand().run(args);
		return {
			code,
			out: log.mock.calls.map(([line]) => String(line)).join('\n'),
			err: error.mock.calls.map(([line]) => String(line)).join('\n')
		};
	};
}
