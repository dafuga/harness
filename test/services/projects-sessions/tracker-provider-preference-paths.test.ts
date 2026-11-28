import { expect, test } from 'vitest';
import { TrackerItemReadRepository } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { queueIdleWork } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerWatchLaunchRequests';
import { quotaHost, quotaNode } from '../../support/trackerQuotaPauseFixture';
import { withTempDir } from '../../support/temporary';

// After the old 27 November window, so without the preference these launches pick Codex.
const start = Date.parse('2026-11-28T12:00:00Z');
const prefer = { provider: 'claude', until: '2026-11-28T14:00:00.000Z' };

const paths = [
	['with the preference', true, { cli: 'claude', model: 'claude-sonnet-5-5' }],
	['without it', false, { cli: 'codex', model: 'gpt-6.2-sol' }]
] as const;

function addUnqueued(host: ReturnType<typeof quotaHost>, id: string) {
	host.runtime.store.appendLocal({
		itemId: id,
		fields: {
			title: 'Add the synthetic export view',
			kind: 'task',
			status: 'open',
			project: 'Harness',
			computer: quotaNode
		}
	});
}

function runs(host: ReturnType<typeof quotaHost>) {
	return host.database.prepare('SELECT cli, model FROM runs ORDER BY queued_at, id').all();
}

test.each(paths)('a manual launch that names no model, %s', (_name, preferred, expected) =>
	withTempDir('hnt-prefer-manual-', async (root) => {
		const host = quotaHost(root);
		host.clock.now = start;
		try {
			if (preferred) await host.api('POST', '/autolaunch/prefer', prefer);
			addUnqueued(host, 'manual0001');
			const launched = await host.api('POST', '/items/manual0001/launch', {});
			expect(launched.status).toBe(200);
			await host.tick();
			expect(runs(host)).toEqual([expect.objectContaining(expected)]);
		} finally {
			host.database.close();
		}
	})
);

// The 17:40 leak: the watchdog launches untouched work even while due launches are paused.
test.each(paths)(
	'an idle-work launch while the due scheduler is paused, %s',
	(_name, preferred, expected) =>
		withTempDir('hnt-prefer-idle-', async (root) => {
			const host = quotaHost(root);
			host.clock.now = start;
			try {
				await host.api('POST', '/autolaunch/pause');
				if (preferred) await host.api('POST', '/autolaunch/prefer', prefer);
				addUnqueued(host, 'idle000001');
				host.clock.now += 60 * 60_000;
				const { store, dispatch } = host.runtime;
				await queueIdleWork(
					store,
					{
						rows: [
							new TrackerItemReadRepository(store.database, () => host.clock.now).getStored(
								'idle000001'
							)
						],
						snapshot: { host: quotaNode, now: host.clock.now, items: [], runs: [], panes: [] },
						dispatch: dispatch!,
						minutes: 30
					},
					new AbortController().signal
				);
				await host.tick();
				expect(runs(host)).toEqual([expect.objectContaining(expected)]);
			} finally {
				host.database.close();
			}
		})
);
