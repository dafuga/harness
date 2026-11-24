// @harness-uid u_bl6xl2h4a3
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import { watchdogManualPrefix } from '../WatchdogPaneService';
import type { WatchdogPane } from '../WatchdogPaneService.types';
import type {
	TrackerSessionHealthIssue,
	TrackerSessionHealthSnapshot
} from './trackerSessionHealth.types';

const sessionName = /^auto-([a-z0-9]{6,10})(?:-r([1-9][0-9]*))?$/;

export function paneItems(snapshot: TrackerSessionHealthSnapshot, pane: WatchdogPane): string[] {
	const [, managedPrefix, runId] = sessionName.exec(pane.name) ?? [];
	const prefix = managedPrefix ?? watchdogManualPrefix(pane.name);
	if (!prefix) return [];
	const exact = snapshot.items.find(({ id }) => id === prefix);
	const matches = exact ? [exact] : snapshot.items.filter(({ id }) => id.startsWith(prefix));
	const owner = runId ? managedOwner(snapshot, matches, pane, Number(runId)) : matches;
	// An ambiguous prefix protects all possible owners from duplicate launches.
	return [
		...new Set([
			...owner.map(({ id }) => id),
			...(runId ? snapshot.linkedItems(Number(runId)) : [])
		])
	];
}

function managedOwner(
	snapshot: TrackerSessionHealthSnapshot,
	matches: readonly TrackerItem[],
	pane: WatchdogPane,
	runId: number
) {
	const confirmed = matches.filter(({ id }) =>
		snapshot
			.runs(id)
			.some((run) => run.node === snapshot.host && run.id === runId && run.tmux === pane.name)
	);
	return confirmed.length ? confirmed : matches;
}

export function unownedPane(
	host: string,
	pane: WatchdogPane,
	associated: readonly string[],
	items: ReadonlyMap<string, TrackerItem>
): TrackerSessionHealthIssue | undefined {
	if (!associated.length && !sessionName.test(pane.name)) return undefined;
	const current = associated.map((id) => items.get(id)).filter((item) => item && !item.deleted);
	if (current.some((item) => item?.status !== 'done' && item?.status !== 'ignored'))
		return undefined;
	const finished = current.length > 0;
	return {
		item_id: current[0]?.id ?? sessionName.exec(pane.name)?.[1] ?? 'unknown',
		host,
		kind: finished ? 'finished' : 'orphan',
		session: pane.name,
		reason: finished
			? `Session ${pane.name} is still live after its Tracker item finished.`
			: `Session ${pane.name} has no matching Tracker item.`,
		identity: pane.key
	};
}
