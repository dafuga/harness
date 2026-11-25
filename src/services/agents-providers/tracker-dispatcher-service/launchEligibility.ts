// @harness-uid u_rzpjc6wqqy
import { isQuietHour } from '../../../helpers/attention-timing/isQuietHour';
import type {
	TrackerDispatchDecision,
	TrackerDispatchItem,
	TrackerDispatchPolicy,
	TrackerDuePolicy,
	TrackerLaunchIntent
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
const nonWorkTitle = /^\s*(?:decision|brainstorm(?:ing)?)(?::|\s+for\b)/i;
const reminderTitle = /^\s*(?:remind(?:er)?\b|watch:)/i;
const deployTitle = /\bPROD\s+DEPLOY/i;
const quietHours = { start: '22:00', end: '08:00', tz: 'Europe/Lisbon' };

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

export function inactive(item: Pick<TrackerDispatchItem, 'deleted' | 'status'>) {
	return item.deleted === true || item.status === 'done' || item.status === 'ignored';
}

// A flag can request feedback while work continues. Explicit dependencies hold recovery.
export function trackerFlagBlocksRecovery(question?: string | null): boolean {
	return /(?:^\s*(?:Blocked:|Tracker recovery:)|\b(?:cannot|can[’']t|unable to|must not|do not|don't)\s+(?:safely\s+)?(?:continue|proceed|resume|relaunch)\b|\b(?:blocked(?: on| by| until)|(?:waiting|paused|on hold) (?:on|for|until))\b)/i.test(
		question ?? ''
	);
}

export function startable(item: TrackerDispatchItem) {
	return (
		!inactive(item) &&
		item.kind === 'task' &&
		(item.status === 'open' || item.status === 'in_progress') &&
		!item.awaitingAnswer &&
		!reminderTitle.test(item.title)
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
		automaticRequestHold(item, policy, now) ??
		(isDueNow(item.due, policy.timezone, now) ? null : 'item is not due')
	);
}

export function automaticEnabled(
	policy: Pick<TrackerDispatchPolicy, 'enabled' | 'automaticEnabled'>
) {
	return policy.enabled !== false && policy.automaticEnabled?.() !== false;
}

export function automaticRequestHold(
	item: TrackerDispatchItem,
	policy: TrackerDispatchPolicy,
	now: number
) {
	return (
		schedulingHold(item, now) ?? (automaticEnabled(policy) ? null : 'automatic launcher disabled')
	);
}

export function automaticQuietHour(now: number) {
	return isQuietHour(now, quietHours);
}

export function schedulingHold(
	item: Pick<
		TrackerDispatchItem,
		| 'title'
		| 'kind'
		| 'status'
		| 'agent'
		| 'owner'
		| 'deleted'
		| 'awaitingAnswer'
		| 'scheduleOff'
		| 'recurring'
		| 'parkedUntil'
	>,
	now: number
): string | null {
	if (item.deleted || item.status === 'done' || item.status === 'ignored')
		return 'item is inactive';
	if (item.scheduleOff) return 'automatic launch opted out';
	if (item.kind !== 'task') return `item is a ${item.kind}; only tasks can launch`;
	if (item.recurring) return 'recurring item';
	if (item.awaitingAnswer) return 'waiting on Daniel';
	if (item.status === 'blocked') return 'item is blocked';
	if (Number(item.parkedUntil) > now) return 'item is parked';
	return unattendedTitleOrAgentHold(item);
}

function unattendedTitleOrAgentHold({
	title,
	owner,
	agent
}: Pick<TrackerDispatchItem, 'title' | 'owner' | 'agent'>) {
	if (deployTitle.test(title)) return 'production deploy requires an explicit launch';
	if (
		reminderTitle.test(title) ||
		nonWorkTitle.test(title) ||
		/^daniel(?: fugere)?$/i.test((owner ?? '').trim())
	) {
		return 'decision or reminder for Daniel';
	}
	return nonWorkAgent.test((agent ?? '').trim())
		? 'personal, brainstorming or Chief of Staff agent'
		: null;
}

export const finalReportPrefix = 'Final report:';

/** A session that reported and stopped stays stopped until something changes on its item. */
export function finalReportHold(
	run: { outcome?: string | null; failure_reason?: string | null; ended_at?: number | null },
	changedAt: number
): string | null {
	return run.outcome === 'abandoned' &&
		run.failure_reason?.startsWith(finalReportPrefix) &&
		changedAt <= (run.ended_at ?? 0)
		? 'the last session ended with a final report'
		: null;
}

export function trackerReminderTitle(title: string) {
	return reminderTitle.test(title);
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

export { activeRun, hasOpenSession, attemptKey, matchesRequest } from './runIdentity';
