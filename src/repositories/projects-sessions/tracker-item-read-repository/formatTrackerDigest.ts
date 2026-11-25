// @harness-uid u_xba7ieg4je
import { trackerStaleDecisionMinutes } from './splitTrackerAsks';
import { trackerStructuredAsk } from '../../../utils/projects-sessions/trackerStructuredAsk';
import type {
	TrackerDigest,
	TrackerDigestItem,
	TrackerRecurringProblem
} from '../TrackerItemReadRepository.types';

/** Render the legacy text digest. Blocked items stay in the first section of the due and flag views. */
export function formatTrackerDigest(digest: TrackerDigest): string {
	const notBlocked = (item: TrackerDigestItem) => item.status !== 'blocked';
	return [
		`Tracker digest - ${digest.local_time}`,
		...section('BLOCKED', digest.blocked, blockedDetail),
		...section(
			'DANIEL DECISIONS',
			digest.daniel_decisions,
			decisionDetail,
			'oldest first; 24h+ is STALE'
		),
		...section(
			'NEEDS OPTIONS',
			digest.needs_options,
			decisionDetail,
			'for Chief of Staff, not shown to Daniel'
		),
		...pingSection(digest.pings),
		...section('QUEUED', digest.queued, (item) =>
			[item.computer && `on ${item.computer}`, waitText(item.waiting_minutes)]
				.filter(Boolean)
				.join(' · ')
		),
		...section('Chased (7d)', digest.chased_7d, (item) =>
			[
				`×${item.chased_count}`,
				item.chased_at,
				item.chased_by && `by ${item.chased_by}`,
				item.chased_reason
			]
				.filter(Boolean)
				.join(' · ')
		),
		...section('OVERDUE', digest.overdue.filter(notBlocked), (item) => `due ${item.due}`),
		...section('DUE TODAY', digest.due_today.filter(notBlocked), (item) =>
			item.due && item.due.length > 10 ? `due ${item.due}` : ''
		),
		...section('RECURRING: MISSED OR FAILED', digest.recurring_missed, recurrenceDetail)
	].join('\n');
}

function section<T extends TrackerDigestItem>(
	title: string,
	items: T[],
	detail: (item: T) => string,
	note?: string
): string[] {
	const heading = `${title} (${items.length}${note ? `; ${note}` : ''})`;
	return items.length
		? [heading, ...items.map((item) => line(item, detail(item)))]
		: [heading, '  (none)'];
}

const PING_LINES_SHOWN = 5;

/** Automated pings stay out of the decisions: the noise collapses to a few lines. */
function pingSection(pings: TrackerDigestItem[]): string[] {
	const shown = pings.slice(0, PING_LINES_SHOWN);
	const hidden = pings.length - shown.length;
	return [
		`CoS/WORKER PINGS (${pings.length})`,
		...(pings.length ? shown.map((item) => line(item, ageText(item))) : ['  (none)']),
		...(hidden ? [`  ... and ${hidden} more`] : [])
	];
}

/** A decision keeps its age, flags a finished item, and shows the question that is still open. */
function decisionDetail(item: TrackerDigestItem): string {
	return [
		ageText(item),
		item.status === 'done' && 'ITEM DONE, FLAG STILL OPEN',
		item.blocked_reason && `blocked: ${item.blocked_reason}`,
		item.next_step
			? [item.project && `Project: ${item.project}`, `Next step: ${item.next_step}`]
					.filter(Boolean)
					.join(' · ')
			: item.question && `Q: ${item.question}`,
		item.parked_until && `Parked until ${item.parked_until}`
	]
		.filter(Boolean)
		.join('; ');
}

function ageText(item: TrackerDigestItem): string {
	const minutes = item.waiting_minutes;
	if (minutes === undefined) return '';
	const hours = Math.floor(minutes / 60);
	const age = hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : shortAge(hours, minutes);
	return `${minutes >= trackerStaleDecisionMinutes ? 'STALE ' : ''}${age} old`;
}

function shortAge(hours: number, minutes: number): string {
	return hours ? `${hours}h` : `${minutes}m`;
}

function line(item: TrackerDigestItem, detail: string): string {
	const assignees = [item.owner && `owner ${item.owner}`, item.agent && `agent ${item.agent}`]
		.filter(Boolean)
		.join(', ');
	const context = [item.kind, assignees, `priority ${item.priority}`].filter(Boolean).join('; ');
	return `  - [${item.id.slice(0, 6)}] ${item.title}${detail ? ` - ${detail}` : ''} (${context}; ${item.stage})`;
}

function blockedDetail(item: TrackerDigestItem): string {
	return [
		item.blocked_reason && `blocked: ${item.blocked_reason}`,
		item.needs_daniel &&
			`${flagLabel(item)} · ${item.next_step ? askDetail(item) : waitText(item.waiting_minutes)}`,
		item.due && `due ${item.due}`
	]
		.filter(Boolean)
		.join('; ');
}

function flagLabel(item: TrackerDigestItem): string {
	return trackerStructuredAsk(item) ? 'NEEDS DANIEL' : 'FLAGGED FOR CHIEF OF STAFF';
}

function askDetail(item: TrackerDigestItem): string {
	return [
		item.project && `Project: ${item.project}`,
		item.next_step ? `Next step: ${item.next_step}` : item.question && `Q: ${item.question}`,
		item.parked_until && `Parked until ${item.parked_until}`,
		waitText(item.waiting_minutes)
	]
		.filter(Boolean)
		.join(' · ');
}

function waitText(minutes: number | undefined): string {
	if (minutes === undefined) return '';
	const hours = Math.floor(minutes / 60);
	return `waiting ${hours ? `${hours}h ` : ''}${minutes % 60}m`;
}

function recurrenceDetail(item: TrackerRecurringProblem): string {
	const failedNote = item.failed?.note ? `: ${item.failed.note}` : '';
	return [
		item.missed && `missed ${item.missed_local}`,
		item.failed && `failed ${item.failed_local}${failedNote}`,
		`every '${item.every}'`
	]
		.filter(Boolean)
		.join('; ');
}
