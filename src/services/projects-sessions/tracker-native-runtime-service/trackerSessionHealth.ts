// @harness-uid u_bl6xl2h4a3
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import type { TrackerListedRun } from '../../../repositories/projects-sessions/TrackerRunReadRepository.types';
import {
	canonicalNode,
	trackerFleetNodes
} from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import type { WatchdogPane } from '../WatchdogPaneService.types';
import type {
	TrackerSessionHealthIssue,
	TrackerSessionHealthSnapshot
} from './trackerSessionHealth.types';

import { recoveryGrace } from '../watchdog-recovery-service/watchdogRecoverySessions';

export const sessionHealthInterval = recoveryGrace;
const sessionName = /^auto-([a-z0-9]{6,10})(?:-r([1-9][0-9]*))?$/;

export function trackerSessionHealth(snapshot: TrackerSessionHealthSnapshot) {
	const { host, items, panes } = snapshot;
	const byId = new Map(items.map((item) => [item.id, item]));
	const liveItems = new Set<string>();
	const issues: TrackerSessionHealthIssue[] = [];
	for (const pane of panes.filter(({ live }) => live)) {
		const associated = paneItems(snapshot, pane);
		for (const id of associated) liveItems.add(id);
		const issue = unownedPane(host, pane, associated, byId);
		if (issue) issues.push(issue);
	}
	for (const item of items.filter(healthItem)) {
		const issue = itemHealth(snapshot, item, liveItems.has(item.id));
		if (issue) issues.push(issue);
	}
	return issues;
}

function healthItem(item: TrackerItem): boolean {
	return (
		!item.deleted &&
		(item.status === 'in_progress' || (item.status === 'open' && Boolean(item.auto)))
	);
}

function paneItems(snapshot: TrackerSessionHealthSnapshot, pane: WatchdogPane): string[] {
	const match = sessionName.exec(pane.name);
	if (!match) return [];
	const [, prefix, runId] = match;
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

function unownedPane(
	host: string,
	pane: WatchdogPane,
	associated: readonly string[],
	items: ReadonlyMap<string, TrackerItem>
): TrackerSessionHealthIssue | undefined {
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

function itemHealth(
	snapshot: TrackerSessionHealthSnapshot,
	item: TrackerItem,
	live: boolean
): TrackerSessionHealthIssue | undefined {
	const history = snapshot.runs(item.id);
	const target = owner(item, history.at(-1));
	if (!canInspectItem(snapshot, target, history)) return undefined;
	const pending = pendingLaunch(snapshot, item, history);
	if (pending) {
		return snapshot.now - pending.at >= sessionHealthInterval
			? stalledIssue(snapshot.host, item, pending.at, pending.run)
			: undefined;
	}
	if (item.status !== 'in_progress' || live) return undefined;
	const issue = missingIssue(snapshot, item, history);
	return target === snapshot.host
		? issue
		: { ...issue, recover: false, reason: `${issue.reason} No Tracker computer is assigned.` };
}

function canInspectItem(
	{ host, reportUnassigned }: TrackerSessionHealthSnapshot,
	target: string,
	history: readonly TrackerListedRun[]
): boolean {
	const unassigned = !target || !trackerFleetNodes.includes(target);
	if (target !== host && !(reportUnassigned && unassigned)) return false;
	return !history.some(
		(run) => run.node !== host && ['running', 'verifying', 'observed'].includes(run.state)
	);
}

function pendingLaunch(
	snapshot: TrackerSessionHealthSnapshot,
	item: TrackerItem,
	history: readonly TrackerListedRun[]
) {
	const queued = history
		.filter(
			(run) =>
				run.node === snapshot.host &&
				run.state === 'queued' &&
				!snapshot.panes.some(({ name, live }) => live && name === run.tmux)
		)
		.at(-1);
	if (queued) return { run: queued, at: queued.queued_at ?? snapshot.scheduleAt(item.id) };
	if (item.auto && !history.some((run) => run.auto_token === item.auto))
		return { at: snapshot.scheduleAt(item.id) };
	return undefined;
}

function owner(item: TrackerItem, latest?: TrackerListedRun): string {
	const choices = [item.launch_target, item.computer, latest?.node, item.created_by];
	const node = choices.find((value) => value && value !== 'auto');
	return node ? canonicalNode(node, {}) : '';
}

function stalledIssue(
	host: string,
	item: TrackerItem,
	at: number,
	run?: TrackerListedRun
): TrackerSessionHealthIssue {
	return {
		item_id: item.id,
		host,
		kind: 'launch-stuck',
		session: run?.tmux ?? null,
		reason: run
			? `Tracker run #${run.id} has been queued for over 10 minutes without a live session.`
			: 'Launch already requested for over 10 minutes without a run.',
		identity: `${run?.id ?? 'request'}:${at}`
	};
}

function missingIssue(
	{ host, now, scheduleAt }: TrackerSessionHealthSnapshot,
	item: TrackerItem,
	history: readonly TrackerListedRun[]
): TrackerSessionHealthIssue {
	const localActive = history.some(
		({ node, state }) => node === host && ['running', 'verifying'].includes(state)
	);
	const latest = history.at(-1);
	const aged = now - Math.max(scheduleAt(item.id), latest?.ended_at ?? 0) >= sessionHealthInterval;
	const hasBrief = [item.notes, item.adapter_instructions, latest, item.auto].some(Boolean);
	const recover = aged && hasBrief && !localActive && restartableItem(item);
	return {
		item_id: item.id,
		host,
		kind: 'missing',
		session: latest?.tmux ?? null,
		reason: missingReason(item, { localActive, hasBrief }),
		identity: `${latest?.id ?? 'no-run'}:${scheduleAt(item.id)}`,
		recover
	};
}

function restartableItem(item: TrackerItem): boolean {
	return (
		item.kind === 'task' &&
		!item.recurring &&
		!item.schedule_off &&
		(!item.needs_daniel || item.resolved)
	);
}

function missingReason(
	item: TrackerItem,
	{ localActive, hasBrief }: { localActive: boolean; hasBrief: boolean }
) {
	if (localActive)
		return 'Tracker run has no live tmux session. The launcher has not settled the run.';
	const reason = 'In-progress item has no live run or session.';
	if (item.needs_daniel && !item.resolved) return reason + ' Recovery is waiting on Daniel.';
	if (item.schedule_off) return reason + ' Automatic launch is opted out.';
	if (!hasBrief) return reason + ' No launch brief is available.';
	return reason;
}
