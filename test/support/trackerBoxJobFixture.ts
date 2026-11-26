import { realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { onTestFinished, vi } from 'vitest';
import { loadTrackerNodeConfig } from '../../src/services/projects-sessions/tracker-node-service/trackerNodeConfig';
import { trackerNodeRuntime } from '../../src/services/projects-sessions/tracker-node-service/trackerNodeRuntime';
import { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { fixtureConfig, privateFixture, trackerFixtureFiles } from './trackerNodeProcess';
import { createTempDirectory } from './temporary';

const hour = 3600_000;

/** A native hub composed from node config. Jobs are real `/bin/sh` processes; time is explicit. */
export async function trackerBoxJobFixture() {
	const root = realpathSync(await createTempDirectory('hbj-'));
	trackerFixtureFiles(root);
	const path = join(root, 'hub.json');
	privateFixture(path, {
		...fixtureConfig(root, 'fixture-hub', 49311),
		role: 'hub',
		syncPort: 49312,
		notifications: { targets: { cos: { url: 'http://127.0.0.1:1/cos' } }, webhook: 'cos' }
	});
	const config = loadTrackerNodeConfig(path);
	const database = new DatabaseSync(config.database);
	let clock = Date.parse('2026-11-21T10:00:00Z');
	const lifetimes: { stop: AbortController; runtime: TrackerNativeRuntimeService }[] = [];
	const start = () => {
		const runtime = new TrackerNativeRuntimeService(database, {
			...trackerNodeRuntime(config),
			now: () => clock
		});
		const wakes = vi.spyOn(runtime.notifications!, 'enqueue');
		const stop = new AbortController();
		lifetimes.push({ stop, runtime });
		return boxJobNode(runtime, wakes, stop);
	};
	onTestFinished(async () => {
		for (const { stop, runtime } of lifetimes) {
			stop.abort();
			await runtime.recurring?.drain?.();
		}
		database.close();
		rmSync(root, { recursive: true, force: true });
	});
	return { root, database, start, advanceHour: () => (clock += hour) };
}

function boxJobNode(
	runtime: TrackerNativeRuntimeService,
	wakes: ReturnType<typeof vi.spyOn>,
	stop: AbortController
) {
	const request = async (method: string, path: string, body?: object) => {
		const init = { method, ...(body && { body: JSON.stringify(body) }) };
		const response = await runtime.items.handle(new Request('http://fixture' + path, init));
		return { status: response.status, body: await response.json() };
	};
	return {
		runtime,
		wakes,
		request,
		async recurringItem(title: string) {
			const created = await request('POST', '/items', { title, every: '@hourly' });
			return created.body.id as string;
		},
		tick: () => runtime.recurring!.tick(stop.signal),
		history: async (id: string) => (await request('GET', `/items/${id}/history`)).body,
		async shutdown() {
			stop.abort();
			await runtime.recurring!.drain();
		}
	};
}
