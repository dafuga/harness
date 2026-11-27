import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, vi, onTestFinished } from 'vitest';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { TrackerSyncAuthService } from '../../../src/services/networking-security/TrackerSyncAuthService';
import { TrackerSpokeSyncService } from '../../../src/services/projects-sessions/TrackerSpokeSyncService';
import type { TrackerSpokeTransport } from '../../../src/services/projects-sessions/TrackerSpokeSyncService.types';
import type { TrackerDispatchRunner } from '../../../src/services/projects-sessions/TrackerDispatchSchedulerService.types';
import { fixturePolicy, primary, secondary } from '../../support/trackerDispatcherFixture';
import { fixtureSecret, wire } from '../../support/trackerDispatchQueueFixture';

function computer(node: string, root: string, transport?: TrackerSpokeTransport) {
	const database = new DatabaseSync(':memory:');
	onTestFinished(() => database.close());
	const start = vi.fn<TrackerDispatchRunner['start']>(async ({ run, key }) => ({
		type: 'session',
		session: { id: run.item_id, key, state: 'live', startedAt: Date.now() }
	}));
	const runtime = new TrackerNativeRuntimeService(database, {
		node,
		role: transport ? 'spoke' : 'hub',
		hostEffects: {
			launch: {
				driver: '/unused-fixture',
				repositories: { Harness: { repo: root, platform: 'macos' } }
			}
		},
		dispatch: {
			policy: fixturePolicy(Date.now),
			runner: { start, observe: async () => undefined, stop: async () => true }
		},
		...(transport
			? { links: [{ secret: fixtureSecret, transport, pullWaitSeconds: 0 }] }
			: { syncResponder: { auth: new TrackerSyncAuthService(fixtureSecret) } })
	});
	return { runtime, start };
}
test('two normal schedulers targeting the same checkout hold the sibling until the owner stops', async () => {
	const root = mkdtempSync(join(tmpdir(), 'harness-areas-'));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	const a = computer(primary, root);
	const transport = wire(a.runtime.sync!);
	const b = computer(secondary, root, transport);
	const link = new TrackerSpokeSyncService({
		store: b.runtime.store,
		transport,
		secret: fixtureSecret,
		pullWaitSeconds: 0
	});
	for (const [id, node, area] of [
		['first11111', primary, 'src/launcher'],
		['second2222', secondary, 'src/launcher/start.ts']
	]) {
		a.runtime.store.appendLocal({
			itemId: id,
			fields: {
				title: id,
				notes: 'Areas: ' + area,
				project: 'Harness',
				kind: 'task',
				status: 'open',
				auto: id,
				launch_source: 'manual',
				computer: node,
				'note+': 'auto-launch requested on ' + node
			}
		});
	}
	await link.pull();
	const signal = new AbortController().signal;
	await a.runtime.scheduler!.tick(signal);
	await b.runtime.scheduler!.tick(signal);
	expect(a.start).toHaveBeenCalledTimes(1);
	expect(a.start.mock.calls[0][2]).toContain('Overlapping siblings: none');
	expect(b.start).not.toHaveBeenCalled();
	expect(b.runtime.store.getMeta('watchdog_alerts')).toContain('first11111');
	await a.runtime.scheduler!.stop('first11111', signal);
	await link.pull();
	await b.runtime.scheduler!.tick(signal);
	expect(b.start).toHaveBeenCalledTimes(1);
	expect(b.start.mock.calls[0][2]).toContain('Previous sibling order: waiting for first11111');
	expect(b.start.mock.calls[0][2]).toContain('tracker land second2222');
});
