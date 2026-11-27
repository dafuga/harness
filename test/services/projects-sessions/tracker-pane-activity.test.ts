import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import type { TrackerTmuxAdapter } from '../../../src/adapters/projects-sessions/TrackerTmuxAdapter';
import { trackerHostInventory } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostInventory';
import type { TrackerHostLaunchPort } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch.types';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import type { WatchdogPane } from '../../../src/services/projects-sessions/WatchdogPaneService.types';
import { primary } from '../../support/trackerDispatcherFixture';

const signal = new AbortController().signal;
const noon = Date.parse('2026-11-25T12:00:00Z');
const minute = 60_000;

function pane(name: string, activity: number, screen: string | null = null): WatchdogPane {
	return {
		name,
		key: 'default:' + name,
		activity,
		createdAt: noon - 300 * minute,
		x: 2,
		y: 0,
		live: true,
		readable: true,
		ready: false,
		attached: false,
		runnerSocket: true,
		currentCommand: 'claude',
		screen
	};
}

test('managed sessions count pane output and live background work as activity', async () => {
	const database = new DatabaseSync(':memory:');
	const store = new TrackerPersistenceService(database, primary, { now: () => noon });
	const names = ['auto-output-r1', 'auto-shells-r2', 'auto-silent-r3'];
	const panes = [
		pane(names[0], noon - 2 * minute),
		pane(names[1], noon - 90 * minute),
		pane(names[2], noon - 90 * minute)
	];
	const footers = new Map([
		[names[1], '❯ \n\n  ⏵⏵ bypass permissions on · 1 shell, 1 monitor'],
		[names[2], '❯ \n\n  ⏵⏵ bypass permissions on']
	]);
	const driver: TrackerHostLaunchPort = {
		inspect: async () =>
			names.map((tmux) => ({
				itemId: tmux.split('-')[1],
				key: tmux,
				id: tmux,
				tmux,
				state: 'live',
				startedAt: noon - 300 * minute
			})),
		start: async () => ({ status: 'pending' })
	};
	const tmux = {
		inventory: async () => panes,
		windows: async () => [],
		captured: async (seen: WatchdogPane) => ({ ...seen, screen: footers.get(seen.name) ?? null })
	} as unknown as TrackerTmuxAdapter;
	try {
		const { sessions } = await trackerHostInventory(
			{ store, driver, tmux, node: primary, runs: [], keys: names, now: noon },
			signal
		);
		expect(sessions.map(({ activityAt }) => activityAt)).toEqual([
			noon - 2 * minute,
			noon,
			noon - 90 * minute
		]);
	} finally {
		database.close();
	}
});
