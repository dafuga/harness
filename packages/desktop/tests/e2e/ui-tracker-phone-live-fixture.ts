import type { Page } from '@playwright/test';
import type { PhoneHost } from './ui-remote-phone-fixture.types';
import type { LivePhoneHost } from './ui-tracker-phone-live-fixture.types';
import { remotePhoneFixture } from './ui-remote-phone-fixture';

/**
 * SYNTHETIC. The phone fixture with the native Tracker replica imitated in the page: its reads, its
 * push state and its `tracker` events. No socket, SQLite or computer exists here.
 */
function installPhoneReplica() {
	const host = window as unknown as PhoneHost & LivePhoneHost;
	const replica: LivePhoneHost['__replica'] = {
		state: 'reconnecting',
		question: 'Ship the first synthetic change?',
		emit: (changed) => {
			host.__remotePhone.listeners.forEach((item) => {
				if (item.eventName === 'tracker') item.callback({ state: replica.state, changed });
			});
		}
	};
	host.__replica = replica;
	const header = () => ({
		id: 'livephone1',
		title: 'Synthetic live decision',
		project: 'Fixture',
		status: 'in_progress',
		updatedAt: '2026-11-26T08:00:00.000Z',
		dueAt: null
	});
	const read = (data: unknown) => ({
		source: 'local_tracker',
		lastSyncedAt: '2026-11-26T08:00:00.000Z',
		freshness: 'current',
		partial: false,
		data
	});
	const flag = () => ({ state: 'open', at: null, question: replica.question });
	const reads: Record<string, () => unknown> = {
		tracker_status: () => ({
			unresolvedFlags: 1,
			needsYou: [{ ...header(), question: replica.question, askedAt: null }],
			recent: []
		}),
		tracker_show: () => ({ item: header(), notes: [], flag: flag(), runs: [] }),
		tracker_write_status: () => ({ writes: [] })
	};
	const added: Record<string, (input: { name: string }) => Promise<unknown>> = {
		trackerTool: async ({ name }) => read(reads[name]?.()),
		refreshTracker: async () => undefined,
		trackerPush: async () => ({ state: replica.state })
	};
	const remote = host.Capacitor.PluginHeaders.find((entry) => entry.name === 'HarnessRemote')!;
	remote.methods.push(...Object.keys(added).map((name) => ({ name, rtype: 'promise' })));
	const native = host.Capacitor.nativePromise;
	host.Capacitor.nativePromise = (plugin, method, input) =>
		plugin === 'HarnessRemote' && added[method]
			? added[method](input as { name: string })
			: native(plugin, method, input);
}

export async function livePhoneFixture(page: Page) {
	await remotePhoneFixture(page, 'online');
	await page.addInitScript(installPhoneReplica);
}
