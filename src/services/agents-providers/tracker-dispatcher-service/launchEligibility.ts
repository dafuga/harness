// @harness-uid u_rzpjc6wqqy
import type {
	TrackerDispatchDecision,
	TrackerDispatchItem,
	TrackerDispatchPolicy,
	TrackerDispatchSnapshot,
	TrackerDuePolicy,
	TrackerLaunchIntent,
	TrackerRunReceipt
} from '../TrackerDispatcherService.types';

const fleetAliases = new Map([
	['mac', 'daniel-primary-mbp'],
	['mb2', 'harbor-mbp-2'],
	['box', 'grok-box']
]);
export const trackerFleetNodes = [...fleetAliases.values()];

export function trackerNodeNames(node: string, hub: boolean): string[] {
	return [
		...new Set([
			node,
			...(hub ? ['box'] : []),
			...[...fleetAliases].filter(([, target]) => target === node).map(([alias]) => alias)
		])
	];
}

const nonWorkAgent =
	/^(?:(?:cos|chief[-_ ]of[-_ ]staff|personal|brainstorm(?:ing)?)(?:$|[-_ ])|(?:daniel|dad|coach|claire|boating|doc|email-router|recruiting)$)/i;
const operationsAgent = /^(?:cos|chief[-_ ]of[-_ ]staff)(?:$|[-_ ])/i;
const nonWorkTitle = /^\s*(?:decision|reminder|brainstorm(?:ing)?)(?::|\s+for\b)/i;

export const minute = 60_000;

export function canonicalNode(
	name: string,
	policy: Pick<TrackerDispatchPolicy, 'resolveHost'>
): string {
	const node = name.trim().toLowerCase();
	return fleetAliases.get(node) ?? policy.resolveHost?.(node) ?? node;
}

export function knownNode(name: string, policy: TrackerDispatchPolicy): boolean {
	const known = [...fleetAliases.keys(), ...trackerFleetNodes, policy.node];
	return known.includes(name) || Boolean(policy.resolveHost?.(name));
}

export function ownsLaunch(intent: TrackerLaunchIntent, policy: TrackerDispatchPolicy): boolean {
	return intent.target
		? canonicalNode(intent.target, policy) === canonicalNode(policy.node, policy)
		: policy.hub === true;
}

export function activeRun(run: TrackerRunReceipt, policy: TrackerDispatchPolicy, now: number) {
	if (run.state === 'finished') return false;
	if (run.node === canonicalNode(policy.node, policy)) return true;
	const touched = run.resumed_at ?? run.started_at ?? run.queued_at;
	return now - touched <= (policy.maxRunMinutes ?? 480) * minute;
}

export function inactive(item: TrackerDispatchItem) {
	return item.deleted === true || item.status === 'done' || item.status === 'ignored';
}

export function startable(item: TrackerDispatchItem) {
	return (
		!inactive(item) &&
		item.kind === 'task' &&
		(item.status === 'open' || item.status === 'in_progress') &&
		!item.awaitingAnswer
	);
}

export function skip(
	status: 'held' | 'conflict' | 'ignored',
	reason: string
): TrackerDispatchDecision {
	return { result: { status, reason } };
}

export function dueOwner(
	item: TrackerDispatchItem,
	due: TrackerDuePolicy,
	policy: TrackerDispatchPolicy
) {
	const computer = item.computer?.trim().toLowerCase();
	const creator = computer && computer !== 'auto' ? computer : item.createdBy;
	const owner = item.adapterDueOwner ?? (due.localDue ? creator : null);
	return owner ? canonicalNode(owner, policy) : null;
}

export function mayScheduleHere(
	item: TrackerDispatchItem,
	due: TrackerDuePolicy,
	policy: TrackerDispatchPolicy
) {
	if (due.paused) return false;
	const owner = dueOwner(item, due, policy);
	const local = canonicalNode(policy.node, policy);
	if (item.adapterDueOwner) return due.adapterDue === true && owner === local;
	if (!due.enabled) return false;
	if (policy.hub && !due.localDue) return true;
	return (
		due.localDue === true &&
		owner === local &&
		(policy.hub === true || due.hubAllowsLocal !== false)
	);
}

export function dueItemHold(item: TrackerDispatchItem, policy: TrackerDispatchPolicy, now: number) {
	return (
		schedulingHold(item, policy) ??
		(isDueNow(item.due, policy.timezone, now) ? null : 'item is not due')
	);
}

export function schedulingHold(
	item: TrackerDispatchItem,
	policy?: Pick<TrackerDispatchPolicy, 'opsWorkdirAvailable'>
): string | null {
	if (item.scheduleOff) return 'automatic launch opted out';
	if (item.kind !== 'task') return `item is a ${item.kind}; only tasks can launch`;
	if (item.recurring) return 'recurring item';
	if (item.awaitingAnswer) return 'waiting on Daniel';
	if (item.status === 'blocked') return 'item is blocked';
	return nonWorkReason(item, policy?.opsWorkdirAvailable);
}

function nonWorkReason(
	item: TrackerDispatchItem,
	opsAvailable?: TrackerDispatchPolicy['opsWorkdirAvailable']
): string | null {
	if (nonWorkTitle.test(item.title) || /^daniel(?: fugere)?$/i.test(item.owner?.trim() ?? '')) {
		return 'decision or reminder for Daniel';
	}
	const agent = item.agent?.trim() ?? '';
	if (operationsAgent.test(agent) && opsAvailable?.(item)) return null;
	return nonWorkAgent.test(agent) ? 'personal, brainstorming or Chief of Staff agent' : null;
}

export function isDueNow(due: string | null | undefined, timezone: string, now: number): boolean {
	if (!due) return false;
	if (due.length !== 10) return Date.parse(due) <= now;
	const parts = new Intl.DateTimeFormat('en', {
		timeZone: timezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(now);
	const date = ['year', 'month', 'day'].map(
		(part) => parts.find(({ type }) => type === part)?.value
	);
	return /^\d{4}-\d{2}-\d{2}$/.test(due) && due <= date.join('-');
}

export function hasOpenSession(
	snapshot: TrackerDispatchSnapshot,
	policy: TrackerDispatchPolicy,
	now: number,
	except?: TrackerRunReceipt
) {
	return (
		snapshot.openSession === true ||
		snapshot.activeSessionKeys?.some((key) => !except || key !== attemptKey(except)) === true ||
		snapshot.runs.some((run) => run !== except && activeRun(run, policy, now))
	);
}

export function attemptKey(run: TrackerRunReceipt): string {
	return JSON.stringify([run.item_id, run.auto_token, run.attempt]);
}

export function matchesRequest(
	item: TrackerDispatchItem | null,
	run: TrackerRunReceipt,
	policy: TrackerDispatchPolicy
) {
	return Boolean(item?.launch?.token === run.auto_token && ownsLaunch(item.launch, policy));
}
