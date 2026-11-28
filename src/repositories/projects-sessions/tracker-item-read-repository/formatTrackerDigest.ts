// @harness-uid u_xba7ieg4je
import { describeTrackerScheduleHold } from '../../../utils/projects-sessions/trackerScheduleHold';
import { isTrackerPhase4Worker } from '../../../utils/projects-sessions/isTrackerPhase4Worker';
import { trackerStaleDecisionMinutes } from './splitTrackerAsks';
import { clipTrackerText } from './clipTrackerText';
import { formatTrackerProject } from './formatTrackerProject';
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
		`PROJECTS (${digest.projects.length})`,
		...(digest.projects.length ? digest.projects.map(formatTrackerProject) : ['  (none)']),
		...section('BLOCKED', digest.blocked, blockedDetail),
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
		...section('AUTOMATIC LAUNCH HOLDS', digest.launch_holds, describeTrackerScheduleHold),
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
		...section('RECURRING: MISSED OR FAILED', digest.recurring_missed, recurrenceDetail),
		...unblockSection(digest.to_unblock)
	].join('\n');
}

function section<T extends TrackerDigestItem>(
	title: string,
	items: T[],
	detail: (item: T) => string,
	note = ''
): string[] {
	const others = items.filter((item) => !isWorker(item));
	const workers = items.filter(isWorker);
	return [
		`${title} (${items.length}${note ? `; ${note}` : ''})`,
		...others.map((item) => line(item, detail(item))),
		...(workers.length ? [workerLine(workers)] : []),
		...(items.length ? [] : ['  (none)'])
	];
}

function isWorker(item: TrackerDigestItem): boolean {
	return isTrackerPhase4Worker(item.title, item.owner);
}

function workerLine(workers: TrackerDigestItem[]): string {
	return `  - Harness Phase 4 workers (${workers.length}): ${workers.map(({ id }) => id.slice(0, 6)).join(', ')}`;
}

const TITLE_LENGTH = 90;
const ACTION_LENGTH = 300;
const PING_LINES_SHOWN = 5;

/** Automated pings stay out of the decisions: the noise collapses to a few lines. */
function pingSection(pings: TrackerDigestItem[]): string[] {
	const others = pings.filter((item) => !isWorker(item));
	const workers = pings.filter(isWorker);
	const shown = others.slice(0, PING_LINES_SHOWN);
	const hidden = others.length - shown.length;
	return [
		`CoS/WORKER PINGS (${pings.length})`,
		...shown.map((item) => line(item, ageText(item))),
		...(hidden ? [`  ... and ${hidden} more`] : []),
		...(workers.length ? [workerLine(workers)] : []),
		...(pings.length ? [] : ['  (none)'])
	];
}

/** The closing list: one line per action, with its id, the ask and how long it has waited. */
function unblockSection(items: TrackerDigestItem[]): string[] {
	return [
		`To unblock (Daniel) (${items.length}; oldest first; 24h+ is STALE)`,
		...(items.length ? items.map(unblockLine) : ['  (none)'])
	];
}

function unblockLine(item: TrackerDigestItem): string {
	const marks = [
		ageText(item),
		item.status === 'done' && 'ITEM DONE, FLAG STILL OPEN',
		item.parked_until && `Parked until ${item.parked_until}`
	].filter(Boolean);
	return `  - [${item.id.slice(0, 6)}] ${clipTrackerText(item.title ?? '', TITLE_LENGTH)} - ${clipTrackerText(unblockAction(item), ACTION_LENGTH)}${marks.length ? ` (${marks.join('; ')})` : ''}`;
}

function unblockAction(item: TrackerDigestItem): string {
	if (!item.needs_daniel) return `blocked: ${item.blocked_reason}`;
	if (item.next_step)
		return [item.project && `Project: ${item.project}`, `Next step: ${item.next_step}`]
			.filter(Boolean)
			.join(' · ');
	if (item.question) return `Q: ${item.question}`;
	return item.blocked_reason ? `blocked: ${item.blocked_reason}` : 'open flag';
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
