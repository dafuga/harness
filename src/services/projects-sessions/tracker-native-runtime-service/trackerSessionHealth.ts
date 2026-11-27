// @harness-uid u_bl6xl2h4a3
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import type { TrackerListedRun } from '../../../repositories/projects-sessions/TrackerRunReadRepository.types';
import {
	canonicalNode,
	trackerFleetNodes
} from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import type {
	TrackerSessionHealthIssue,
	TrackerSessionHealthSnapshot
} from './trackerSessionHealth.types';

import { hasRecoveryBrief, recoveryHold } from './trackerRecoveryHistory';
import { handLaunchNode } from './trackerHandLaunchSelection';
import { recoveryGrace } from '../watchdog-recovery-service/watchdogRecoverySessions';

export const sessionHealthInterval = recoveryGrace;
import { paneItems, unownedPane } from './trackerSessionHealthPanes';
export const recoveryPollInterval = 60_000;

export function trackerSessionHealth(snapshot: TrackerSessionHealthSnapshot) {
	const { host, items, panes } = snapshot;
	const byId = new Map(items.map((item) => [item.id, item]));
	const liveItems = new Set<string>();
	const issues: TrackerSessionHealthIssue[] = [];
	for (const pane of panes.filter(({ live }) => live)) {
		const associated = paneItems(snapshot, pane);
		for (const id of associated) liveItems.add(id);
		const issue = unownedPane(host, pane, associated, byId);
		if (issue && !(issue.kind === 'finished' && snapshot.judgedByRun?.has(pane.key)))
			issues.push(issue);
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
		(item.kind ?? 'task') === 'task' &&
		(item.status === 'in_progress' || (item.status === 'open' && Boolean(item.auto)))
	);
}

function itemHealth(
	snapshot: TrackerSessionHealthSnapshot,
	item: TrackerItem,
	live: boolean
): TrackerSessionHealthIssue | undefined {
	const history = snapshot.runs(item.id);
	const pending = pendingLaunch(snapshot, item, history);
	const target = owner(item, history, Boolean(pending));
	if (!canInspectItem(snapshot, target, history) || live) return undefined;
	if (pending?.run || ordinaryOpenItem(item))
		return pending && overdueLaunch(snapshot, item, pending);
	if (pending && waitingForPriorRequest(item, snapshot.now - pending.at)) return undefined;
	const issue = missingIssue(snapshot, item, history);
	return target === snapshot.host
		? issue
		: {
				...issue,
				recover: false,
				blockReason: 'No Tracker computer is assigned.',
				reason: `${issue.reason} No Tracker computer is assigned.`
			};
}

function ordinaryOpenItem(item: TrackerItem) {
	return item.status === 'open' && item.launch_source !== 'recovery';
}

function overdueLaunch(
	snapshot: TrackerSessionHealthSnapshot,
	item: TrackerItem,
	pending: { at: number; run?: TrackerListedRun }
) {
	const recovering = item.launch_source === 'recovery';
	if (recovering && pending.run?.state === 'queued' && !pending.run.started_at) return undefined;
	const threshold = recovering ? 3 * sessionHealthInterval : sessionHealthInterval;
	if (snapshot.now - pending.at >= threshold)
		return stalledIssue(snapshot.host, item, pending, recovering);
	return undefined;
}

function waitingForPriorRequest(item: TrackerItem, age: number) {
	return item.launch_source !== 'recovery' && age < sessionHealthInterval;
}

function canInspectItem(
	{ host, reportUnassigned }: TrackerSessionHealthSnapshot,
	target: string,
	history: readonly TrackerListedRun[]
): boolean {
	const unassigned = !target || !trackerFleetNodes.includes(target);
	if (target !== host && !(reportUnassigned && unassigned)) return false;
	return !history.some(
		(run) => run.node !== host && ['queued', 'running', 'verifying', 'observed'].includes(run.state)
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

function owner(item: TrackerItem, history: readonly TrackerListedRun[], pending: boolean): string {
	const latest = history.filter(({ started_at }) => started_at != null).at(-1) ?? history.at(-1);
	const choices = pending
		? [item.launch_target, item.computer, latest?.node, item.created_by]
		: [
				handLaunchNode(item, latest?.started_at ?? 0),
				latest?.node,
				item.launch_target,
				item.computer,
				item.created_by
			];
	const node = choices.find((value) => value && value !== 'auto');
	return node ? canonicalNode(node, {}) : '';
}
function stalledIssue(
	host: string,
	item: TrackerItem,
	{ at, run }: { at: number; run?: TrackerListedRun },
	recovering: boolean
): TrackerSessionHealthIssue {
	return {
		item_id: item.id,
		host,
		kind: 'launch-stuck',
		session: run?.tmux ?? null,
		reason: run
			? `Tracker run #${run.id} has been queued for over ${recovering ? 30 : 10} minutes without a live session.`
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
	const changedAt = scheduleAt(item.id);
	const hasBrief = hasRecoveryBrief(item, latest);
	const hold = recoveryHold(item, latest, { changedAt, now });
	const aged = eligibleRecoveryAge(item, latest, now - changedAt);
	return {
		item_id: item.id,
		host,
		kind: 'missing',
		session: latest?.tmux ?? null,
		reason: missingReason({ localActive, hasBrief, hold }),
		identity: `${latest?.id ?? 'no-run'}:${changedAt}`,
		...missingDisposition({ localActive, aged, hasBrief, hold })
	};
}

function missingDisposition({
	localActive,
	aged,
	hasBrief,
	hold
}: {
	localActive: boolean;
	aged: boolean;
	hasBrief: boolean;
	hold: string | null;
}) {
	if (localActive || !aged) return { recover: false };
	if (hold) return { recover: false, blockReason: hold };
	if (!hasBrief) return { recover: false, blockReason: 'No launch brief is available' };
	return { recover: true };
}

function eligibleRecoveryAge(item: TrackerItem, latest: TrackerListedRun | undefined, age: number) {
	return (
		latest?.state === 'finished' ||
		item.launch_source === 'recovery' ||
		age >= sessionHealthInterval
	);
}

function missingReason({
	localActive,
	hasBrief,
	hold
}: {
	localActive: boolean;
	hasBrief: boolean;
	hold: string | null;
}) {
	if (localActive)
		return 'Tracker run has no live tmux session. The launcher has not settled the run.';
	const reason = 'In-progress item has no live run or session.';
	if (hold) return reason + ` Recovery held: ${hold}.`;
	if (!hasBrief) return reason + ' No launch brief is available.';
	return reason;
}
