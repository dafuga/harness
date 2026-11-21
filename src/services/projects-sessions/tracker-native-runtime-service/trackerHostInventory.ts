// @harness-uid u_bl6xl2h4a3
import type { TrackerHostProcessAdapter } from '../../../adapters/projects-sessions/TrackerHostProcessAdapter';
import type { TrackerTmuxAdapter } from '../../../adapters/projects-sessions/TrackerTmuxAdapter';
import type { WatchdogPane } from '../WatchdogPaneService.types';
import type { TrackerHostSession } from './trackerHostLaunch.types';
import { hostInventory } from './trackerHostLaunchSchema';

export async function trackerHostInventory(
	{
		driver,
		tmux,
		node
	}: { driver: TrackerHostProcessAdapter; tmux?: TrackerTmuxAdapter; node: string },
	signal: AbortSignal
) {
	const [value, panes] = await Promise.all([
		driver.request('inspect', { node }, signal),
		tmux?.inventory(signal) ?? []
	]);
	const sessions = hostInventory.parse(value);
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
