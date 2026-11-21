import type {
	TrackerDispatchDecision,
	TrackerDispatchItem,
	TrackerDispatchPolicy,
	TrackerDispatchSnapshot,
	TrackerLaunchIntent,
	TrackerLaunchOptions,
	TrackerLaunchRequest
} from '../TrackerDispatcherService.types';
import {
	canonicalNode,
	dueItemHold,
	dueOwner,
	hasOpenSession,
	inactive,
	knownNode,
	mayScheduleHere,
	skip,
	startable
} from './launchEligibility';

export function requestLaunch(
	snapshot: TrackerDispatchSnapshot,
	request: TrackerLaunchRequest,
	policy: TrackerDispatchPolicy,
	now: number
): TrackerDispatchDecision {
	const { item } = snapshot;
	if (!item || inactive(item)) return skip('held', 'item is missing or inactive');
	if (!request.token.trim()) return skip('conflict', 'launch token is required');
	return request.source === 'manual'
		? manualIntent(snapshot, { ...request, item }, policy, now)
		: dueIntent(snapshot, { item, token: request.token }, policy, now);
}

function manualIntent(
	snapshot: TrackerDispatchSnapshot,
	request: { item: TrackerDispatchItem; token: string; options?: TrackerLaunchOptions },
	policy: TrackerDispatchPolicy,
	now: number
): TrackerDispatchDecision {
	const { item, options, token } = request;
	const updated = { ...item, ...options };
	const wanted = (updated.computer ?? 'auto').trim().toLowerCase() || 'auto';
	const busy = hasOpenSession(snapshot, policy, now);
	const intent = existingIntent(snapshot, item, { busy, token });
	if (intent) {
		return repeatedRequest(intent, { item, updated, wanted }, policy, busy);
	}
	if (busy) return skip('conflict', 'a session is already open for this item');
	if (snapshot.runs.some((run) => run.auto_token === token))
		return skip('conflict', 'launch token was already used');
	const target = manualTarget(updated, wanted, policy);
	if (!target.node) return skip('held', target.why);
	return writeIntent(
		{ token, target: canonicalNode(target.node, policy), source: 'manual' },
		options
	);
}

function existingIntent(
	snapshot: TrackerDispatchSnapshot,
	item: TrackerDispatchItem,
	{ busy, token }: { busy: boolean; token: string }
) {
	const intent = item.launch;
	if (!intent) return null;
	const waiting = startable(item) && !snapshot.runs.some((run) => run.auto_token === intent.token);
	return busy || waiting || intent.token === token ? intent : null;
}

function repeatedRequest(
	intent: TrackerLaunchIntent,
	{
		item,
		updated,
		wanted
	}: { item: TrackerDispatchItem; updated: TrackerDispatchItem; wanted: string },
	policy: TrackerDispatchPolicy,
	busy: boolean
): TrackerDispatchDecision {
	const sameTarget =
		wanted === 'auto' ||
		Boolean(
			intent.target && canonicalNode(wanted, policy) === canonicalNode(intent.target, policy)
		);
	const sameOptions =
		(['project', 'repo', 'model'] as const).every(
			(key) => (updated[key] ?? null) === (item[key] ?? null)
		) && Boolean(updated.sensitive) === Boolean(item.sensitive);
	if (sameTarget && sameOptions) return { result: { status: 'existing', intent } };
	return skip(
		'conflict',
		busy
			? 'a session is already open for this item'
			: 'launch already queued; cancel it before changing its target or options'
	);
}

function manualTarget(item: TrackerDispatchItem, wanted: string, policy: TrackerDispatchPolicy) {
	if (wanted === 'auto') {
		const choice = policy.chooseHost(item, { source: 'manual', requestedNode: null });
		return { ...choice, node: choice.node ?? manualFallback(item, policy) };
	}
	if (knownNode(wanted, policy)) return { node: canonicalNode(wanted, policy), why: '' };
	return { node: null, why: 'computer must be mac, mb2, box, auto, or a known tracker node' };
}

function manualFallback(item: TrackerDispatchItem, policy: TrackerDispatchPolicy) {
	if (policy.localRepoAvailable?.(item)) return policy.node;
	if (item.repo?.startsWith('/home/box/')) return 'box';
	return policy.enabled !== false || policy.hub ? policy.node : 'box';
}

function dueIntent(
	snapshot: TrackerDispatchSnapshot,
	{ item, token }: { item: TrackerDispatchItem; token: string },
	policy: TrackerDispatchPolicy,
	now: number
): TrackerDispatchDecision {
	const { due } = snapshot;
	if (!due || !mayScheduleHere(item, due, policy))
		return skip('held', 'due scheduler is unavailable for this item');
	const hold = dueItemHold(item, policy, now) ?? dueIntentHold(snapshot, item, policy, now);
	if (hold) return skip('held', hold);
	if (snapshot.runs.some((run) => run.auto_token === token))
		return skip('conflict', 'launch token was already used');
	const requestedNode = dueOwner(item, due, policy) ?? preferredComputer(item, policy);
	return assignedDueIntent(item, { token, requestedNode }, policy);
}

function preferredComputer(item: TrackerDispatchItem, policy: TrackerDispatchPolicy) {
	const preferred = item.computer?.trim().toLowerCase();
	return preferred && preferred !== 'auto' ? canonicalNode(preferred, policy) : null;
}

function assignedDueIntent(
	item: TrackerDispatchItem,
	{ token, requestedNode }: { token: string; requestedNode: string | null },
	policy: TrackerDispatchPolicy
): TrackerDispatchDecision {
	const choice = policy.chooseHost(item, { source: 'due', requestedNode });
	if (!choice.node) return skip('held', choice.why);
	const target = canonicalNode(choice.node, policy);
	if (requestedNode && target !== requestedNode)
		return skip('held', 'due launch assigned to a different computer');
	const pick = policy.pickModel(item);
	if ('error' in pick) return skip('held', pick.error);
	return writeIntent({ token, target, source: 'due', scheduledPick: pick });
}

function dueIntentHold(
	snapshot: TrackerDispatchSnapshot,
	item: TrackerDispatchItem,
	policy: TrackerDispatchPolicy,
	now: number
) {
	if (item.status === 'in_progress') return 'item is already in progress';
	if (item.launch) return 'launch already requested';
	if (hasOpenSession(snapshot, policy, now)) return 'item already has an open session';
	return item.repo || item.project || item.agent ? null : 'no repo or project';
}

function writeIntent(
	intent: TrackerLaunchIntent,
	options?: TrackerLaunchOptions
): TrackerDispatchDecision {
	return {
		result: { status: 'requested', intent },
		writes: { item: { ...options, computer: intent.target, launch: intent } }
	};
}
