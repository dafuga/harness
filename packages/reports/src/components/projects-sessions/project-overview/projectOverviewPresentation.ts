// @harness-uid u_heb2rvinqp
import type { ProjectOverviewDetailRow, ProjectOverviewSelection } from './ProjectOverview.types';
import type {
	OverviewCard,
	OverviewItem,
	ProjectState
} from '../../../lib/projects-sessions/project-overview/projectOverview.types';
import type {
	OverviewBand,
	OverviewBandId,
	OverviewChip,
	OverviewEta,
	OverviewFilter
} from './projectOverviewPresentation.types';

const stateNames: Record<ProjectState, string> = {
	'needs-you': 'Needs you',
	blocked: 'Blocked',
	active: 'Active',
	quiet: 'Quiet',
	done: 'Done'
};
const statusNames: Record<OverviewItem['status'], string> = {
	open: 'Open',
	in_progress: 'In progress',
	blocked: 'Blocked',
	done: 'Done'
};
const filterOrder: ProjectState[] = ['needs-you', 'blocked', 'active', 'quiet', 'done'];
const bandDefinitions: { id: OverviewBandId; label: string; states: ProjectState[] }[] = [
	{ id: 'attention', label: 'Needs attention', states: ['needs-you', 'blocked'] },
	{ id: 'active', label: 'Active', states: ['active'] },
	{ id: 'quiet', label: 'Quiet', states: ['quiet'] },
	{ id: 'done', label: 'Done', states: ['done'] }
];
const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const whenFormat = new Intl.DateTimeFormat('en-GB', {
	day: 'numeric',
	month: 'short',
	hour: '2-digit',
	minute: '2-digit'
});

/** @pure The label a project state is shown and filtered under. */
export function stateLabel(state: ProjectState): string {
	return stateNames[state];
}

/** @pure The words an item status is shown with. */
export function statusLabel(status: OverviewItem['status']): string {
	return statusNames[status];
}

/** @pure Quiet and done projects are shown as compact cards. */
export function isCompact(state: ProjectState): boolean {
	return state === 'quiet' || state === 'done';
}

/** @pure A count with its noun in the singular or plural. */
export function countOf(count: number, one: string, many: string): string {
	return `${count} ${count === 1 ? one : many}`;
}

/** @pure The headline names how many projects are waiting on Daniel. */
export function headline(cards: OverviewCard[]): string {
	const waiting = cards.filter((card) => card.state === 'needs-you').length;
	if (waiting === 0) return 'Nothing is waiting on you';
	return waiting === 1 ? '1 project is waiting on you' : `${waiting} projects are waiting on you`;
}

/** @pure The project and live session totals under the headline. */
export function totalsLine(projects: number, liveSessions: number): string {
	return `${countOf(projects, 'project', 'projects')} · ${countOf(liveSessions, 'live session', 'live sessions')}`;
}

/** @pure The chips in order, each with the count of projects it selects. */
export function filterChips(cards: OverviewCard[]): OverviewChip[] {
	const chips: OverviewChip[] = [{ value: 'all', label: 'All', count: cards.length }];
	for (const state of filterOrder) {
		const count = cards.filter((card) => card.state === state).length;
		chips.push({ value: state, label: stateLabel(state), count });
	}
	return chips;
}

/** @pure The projects a filter selects, in the order they were given. */
export function visibleCards(cards: OverviewCard[], filter: OverviewFilter): OverviewCard[] {
	return filter === 'all' ? cards : cards.filter((card) => card.state === filter);
}

/** @pure The bands of the given projects in page order; a band without projects is left out. */
export function bandsFor(cards: OverviewCard[]): OverviewBand[] {
	return bandDefinitions
		.map((definition) => ({
			id: definition.id,
			label: definition.label,
			cards: definition.states.flatMap((state) => cards.filter((card) => card.state === state))
		}))
		.filter((band) => band.cards.length > 0);
}

/** @pure The ETA shown for an item, judged against the time given in milliseconds. */
export function etaFor(due: string | null, now: number): OverviewEta {
	const at = due === null ? Number.NaN : Date.parse(due);
	if (Number.isNaN(at)) return { text: 'No ETA', tone: 'none' };
	if (at < now) return { text: 'Overdue', tone: 'overdue' };
	return { text: `Due ${dayFormat.format(at)}`, tone: 'scheduled' };
}

/** @pure A timestamp in words, or the words for a time that cannot be read. */
export function formatWhen(iso: string): string {
	const at = Date.parse(iso);
	return Number.isNaN(at) ? 'unknown time' : whenFormat.format(at);
}

/** @pure The sort key of a due time; an item with no due time sorts last. */
function dueKey(item: OverviewItem): number {
	const at = item.due === null ? Number.NaN : Date.parse(item.due);
	return Number.isNaN(at) ? Number.POSITIVE_INFINITY : at;
}

/** @pure The items in progress: live runs first, then by due time, with no due time last. */
export function inProgressItems(items: OverviewItem[]): OverviewItem[] {
	return items
		.filter((item) => item.status === 'in_progress')
		.sort((left, right) => Number(right.live) - Number(left.live) || dueKey(left) - dueKey(right));
}

/** @pure The live session line of a card. */
export function sessionsText(liveSessions: number): string {
	return liveSessions > 0
		? countOf(liveSessions, 'live session', 'live sessions')
		: 'No live session';
}

/** @pure The open, in-progress, blocked and done counts of a card, in words. */
export function countsText(counts: OverviewCard['counts']): string {
	const parts: string[] = [];
	if (counts.open > 0) parts.push(`${counts.open} open`);
	if (counts.in_progress > 0) parts.push(`${counts.in_progress} in progress`);
	if (counts.blocked > 0) parts.push(`${counts.blocked} blocked`);
	if (counts.done > 0) parts.push(`${counts.done} done`);
	return parts.length ? parts.join(' · ') : 'No items';
}

/** Resolve against the current owner snapshot so an expired item, decision or run closes. */
export function overviewSelection(
	cards: OverviewCard[],
	selection: ProjectOverviewSelection | null
) {
	if (!selection) return null;
	for (const card of cards) {
		const surfaced = [card.attention, card.blocked].find(
			(entry) => entry?.item.id === selection.itemId
		);
		const item = card.items.find((entry) => entry.id === selection.itemId) ?? surfaced?.item;
		if (!item) continue;
		return detailFor(card, item, selection, surfaced?.text);
	}
	return null;
}

function detailFor(
	card: OverviewCard,
	item: OverviewItem,
	selection: ProjectOverviewSelection,
	context: string | undefined
) {
	if (selection.kind === 'run') {
		const run = item.runs?.find(
			(entry) => entry.id === selection.run.id && entry.computer === selection.run.computer
		);
		return run ? { item, title: `Run #${run.id}`, run } : null;
	}
	const decision = selection.kind === 'decision';
	if (decision && card.attention?.item.id !== item.id) return null;
	return {
		item,
		title: decision ? 'Review decision' : item.title,
		run: null,
		project: card.agent,
		context,
		decision
	};
}

export function overviewDetailRows(
	detail: ReturnType<typeof overviewSelection>,
	now: number
): ProjectOverviewDetailRow[] {
	if (!detail) return [];
	const { item, run } = detail;
	if (run) {
		return [
			{ term: 'Item', value: item.title },
			{ term: 'Run ID', value: String(run.id) },
			{ term: 'Computer', value: run.computer ?? 'Unavailable' },
			{ term: 'Status', value: 'Running' }
		];
	}

	const rows = [
		{ term: 'Project', value: detail.project },
		{ term: 'Status', value: statusLabel(item.status) },
		{ term: 'ETA', value: etaFor(item.due, now).text },
		{ term: 'Live', value: item.live ? 'Yes' : 'No' },
		{ term: 'Stale', value: item.stale ? 'Yes' : 'No' },
		{ term: 'Updated', value: formatWhen(item.updatedAt) },
		{ term: 'Id', value: item.id }
	];
	if (detail.context)
		rows.push({ term: detail.decision ? 'Question' : 'Context', value: detail.context });
	return rows;
}
