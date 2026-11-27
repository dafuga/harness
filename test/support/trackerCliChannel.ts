import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { vi } from 'vitest';
import { runNativeTracker } from '../../src/commands/projects-sessions/tracker-command/runNativeTracker';
import { TrackerItemReadRepository } from '../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerRunReadRepository } from '../../src/repositories/projects-sessions/TrackerRunReadRepository';
import { TrackerLocalApiService } from '../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerPersistenceService } from '../../src/services/projects-sessions/TrackerPersistenceService';
import { trackerHostWatchdog } from '../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostWatchdog';
import { withTempDir } from './temporary';
import type { TrackerCliChannel } from './trackerCliChannel.types';

export const channelItem = 'monitor001';
export const channelStart = Date.parse('2026-11-26T12:00:00Z');

/** The real `tracker` command line against the real item API over one isolated journal. */
export async function withTrackerCliChannel(
	use: (channel: TrackerCliChannel) => Promise<void>
): Promise<void> {
	await withTempDir('tracker-cli-channel-', async (directory) => {
		const config = writeConfig(directory);
		const database = new DatabaseSync(':memory:');
		try {
			await use(channelOver(database, config));
		} finally {
			vi.unstubAllGlobals();
			vi.restoreAllMocks();
			database.close();
		}
	});
}

function writeConfig(directory: string): string {
	const path = join(directory, 'tracker.json');
	const config = {
		version: 1,
		node: 'fixture-spoke',
		role: 'spoke',
		database: join(directory, 'tracker.db'),
		apiPort: 49_151,
		legacyFenceFile: join(directory, 'fence.json'),
		syncSecretFile: join(directory, 'sync.secret'),
		upstream: { url: 'http://127.0.0.1:49152' }
	};
	writeFileSync(path, JSON.stringify(config), { mode: 0o600 });
	return path;
}

function channelOver(database: DatabaseSync, config: string): TrackerCliChannel {
	let now = channelStart;
	const store = new TrackerPersistenceService(database, 'fixture-spoke', { now: () => now });
	const items = new TrackerItemReadRepository(database);
	const api = new TrackerLocalApiService(store, items, {
		now: () => now,
		runs: new TrackerRunReadRepository(database, store.node)
	});
	store.appendLocal({
		itemId: channelItem,
		fields: { title: 'Sample monitor target', status: 'in_progress', kind: 'task' }
	});
	const watchdog = trackerHostWatchdog(store, { transcriptRoots: [] }, { now: () => now });
	let online = true;
	vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
		if (!online) throw new TypeError('connection refused');
		const target = url.replace('/native/v1', '');
		return api.handle(
			new Request(target, { ...init, body: init.method === 'GET' ? null : init.body })
		);
	});
	const output: string[] = [];
	for (const stream of ['log', 'error'] as const)
		vi.spyOn(console, stream).mockImplementation((...words) => void output.push(words.join(' ')));
	return {
		store,
		items,
		inbox: () => watchdog.alerts(),
		advance: (milliseconds) => void (now += milliseconds),
		offline: () => void (online = false),
		async run(...args) {
			output.length = 0;
			const code = await runNativeTracker(args, config);
			return { code, out: output.join('\n') };
		}
	};
}
