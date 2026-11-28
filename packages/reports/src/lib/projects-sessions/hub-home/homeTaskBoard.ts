// @harness-uid u_ycwbrdbild
import { trackerStructuredAsk } from '../../../../../../src/utils/projects-sessions/trackerStructuredAsk';
import { isWithin, WEEK_MS } from '../project-overview/projectOverviewItems';
import { homeText } from './homeTrackerText';
import type { HomeWorkRow } from './homeLive.types';
import type {
	HomeBoardCard,
	HomeBoardColumn,
	HomeBoardCount,
	HomeBoardPriority,
	HomeBoardWork,
	HomeTaskBoard
} from './homeTaskBoard.types';

/** Cards sent for one project in one column; the counts still include every item. */
export const homeBoardCardsPerProject = 25;

const priorityOrder: HomeBoardPriority[] = ['urgent', 'normal', 'low'];

function priorityOf(value: string | null | undefined): HomeBoardPriority {
	return priorityOrder.find((priority) => priority === value) ?? 'normal';
}

type Placed = Pick<HomeBoardCard, 'column' | 'label' | 'reason' | 'row'>;

function place(column: HomeBoardColumn, label: string, row: HomeWorkRow, reason?: string | null) {
	return { column, label, row, reason: reason ?? null } satisfies Placed;
}

/** One line saying why, without the prefix the column heading already says. */
function reasonLine(text: string | null | undefined) {
	const line = homeText(text, 240)
		?.replace(/\s+/g, ' ')
		.replace(/^Blocked: /, '')
		.trim();
	return line || 'No reason recorded';
}

function placeBlocked({ item, rows, resting }: HomeBoardWork, needsYou: boolean) {
	const row = rows[0] ?? resting;
	const why = needsYou ? (item.question ?? item.blocked_reason) : item.blocked_reason;
	return place('blocked', needsYou ? 'Needs you' : 'Blocked', row, reasonLine(why ?? row.now));
}

/** @pure Open and queued work, which the Live overview splits into queued, paused and ended. */
function placeWaiting(row: HomeWorkRow) {
	if (row.launchHold)
		return place('todo', row.launchHold.until ? 'Launch paused' : 'Manual launch', row);
	if (row.state !== 'queued') return place('todo', 'Open', row);
	return place('todo', row.runId ? `Queued #${row.runId.toLocaleString('en-US')}` : 'Queued', row);
}

function placeOpen({ rows, resting }: HomeBoardWork): Placed {
	const running = rows.find((row) => row.state === 'running');
	if (running) return place('progress', 'Running', running);
	const offline = rows.find((row) => row.state === 'offline');
	if (offline)
		return place(
			'blocked',
			'Computer offline',
			offline,
			`${offline.computer ?? 'Its computer'} is offline`
		);
	const row = rows.find((entry) => entry.state !== 'finished');
	if (row?.state === 'blocked' && !row.launchHold)
		return place('blocked', 'Blocked', row, reasonLine(row.now));
	return placeWaiting(row ?? { ...resting, state: 'queued', now: null });
}

/** @pure Where an item belongs, or null when it finished more than seven days ago. */
function placeItem(work: HomeBoardWork, needsYou: boolean, now: number): Placed | null {
	const { item, resting } = work;
	if (item.status === 'done')
		return isWithin(item.updated_at, WEEK_MS, now)
			? place('done', 'Done', { ...resting, state: 'finished' })
			: null;
	if (needsYou || item.status === 'blocked') return placeBlocked(work, needsYou);
	return placeOpen(work);
}

function toCard(work: HomeBoardWork, now: number): HomeBoardCard | null {
	const needsYou = work.item.status !== 'done' && trackerStructuredAsk(work.item);
	const placed = placeItem(work, needsYou, now);
	if (!placed) return null;
	const project = homeText(work.item.project || work.item.agent, 200) ?? 'No project';
	return { ...placed, project, needsYou, priority: priorityOf(work.item.priority) };
}

/** Asks first, then the most urgent, then the newest change. Done is newest first. */
function compareCards(a: HomeBoardCard, b: HomeBoardCard) {
	const recent = b.row.updatedAt.localeCompare(a.row.updatedAt) || a.row.key.localeCompare(b.row.key);
	if (a.column === 'done' && b.column === 'done') return recent;
	return (
		Number(b.needsYou) - Number(a.needsYou) ||
		priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority) ||
		recent
	);
}

/** @pure The Kanban board of the listed items, with honest counts beyond the card limit. */
export function buildHomeTaskBoard(works: HomeBoardWork[], now: number): HomeTaskBoard {
	const all = works.flatMap((work) => toCard(work, now) ?? []).sort(compareCards);
	const counts = new Map<string, HomeBoardCount>();
	const cards = all.filter((card) => {
		const count = counts.get(card.project) ?? {
			project: card.project,
			todo: 0,
			progress: 0,
			blocked: 0,
			done: 0
		};
		counts.set(card.project, count);
		return ++count[card.column] <= homeBoardCardsPerProject;
	});
	return {
		cards,
		counts: [...counts.values()].sort((a, b) => a.project.localeCompare(b.project))
	};
}
