// @harness-uid u_bl6xl2h4a3
import type { TrackerTmuxAdapter } from '../../../adapters/projects-sessions/TrackerTmuxAdapter';
import type { WatchdogPane } from '../WatchdogPaneService.types';
import type { TrackerHostLaunchPort, TrackerHostSession } from './trackerHostLaunch.types';

export async function trackerHostInventory(
	{
		driver,
		tmux,
		node,
		keys
	}: {
		driver: TrackerHostLaunchPort;
		tmux?: TrackerTmuxAdapter;
		node: string;
		keys: readonly string[];
	},
	signal: AbortSignal
) {
	const [sessions, panes] = await Promise.all([
		driver.inspect({ node, keys }, signal),
		tmux?.inventory(signal) ?? []
	]);
	const direct = panes.flatMap((pane) => {
		const evidence = legacyTmuxSession(pane);
		return evidence &&
			!sessions.some(
				(entry) => entry.tmux === evidence.tmux || entry.legacyRunId === evidence.legacyRunId
			)
			? [evidence]
			: [];
	});
	return {
		sessions: [...sessions, ...direct],
		manual: panes.filter((pane) => pane.live && /^auto-[a-z0-9]{6,10}$/.test(pane.name))
	};
}

function legacyTmuxSession(pane: WatchdogPane): TrackerHostSession | undefined {
	const match = /^auto-([a-z0-9]{6,10})-r([0-9]+)$/.exec(pane.name);
	if (!pane.runnerSocket || !match || !pane.ready || !pane.live) return undefined;
	const [, itemId, runId] = match;
	return {
		itemId,
		key: 'legacy:' + runId,
		id: pane.key,
		state: 'live',
		tmux: pane.name,
		legacyRunId: Number(runId),
		startedAt: pane.createdAt,
		activityAt: pane.activity
	};
}
