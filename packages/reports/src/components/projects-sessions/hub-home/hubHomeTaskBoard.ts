// @harness-uid u_ycwbrdview
import type { LinkedHome } from '$reports/lib/projects-sessions/hub-home/homeLive.types';
import type {
	HomeBoardCard,
	HomeBoardColumn,
	HomeTaskBoard
} from '$reports/lib/projects-sessions/hub-home/homeTaskBoard.types';
import { liveNotice } from './hubHomeLive';
import type { HomeBoardColumnView } from './hubHomeTaskBoard.types';
export type { HomeBoardColumnView } from './hubHomeTaskBoard.types';

const columns: Pick<HomeBoardColumnView, 'id' | 'title' | 'note' | 'empty'>[] = [
	{ id: 'todo', title: 'To do', note: null, empty: 'Nothing waiting to start.' },
	{ id: 'progress', title: 'In progress', note: null, empty: 'Nothing running.' },
	{ id: 'blocked', title: 'Blocked', note: null, empty: 'Nothing blocked.' },
	{ id: 'done', title: 'Done', note: 'last 7 days', empty: 'Nothing finished in 7 days.' }
];

export const priorityLabels = { urgent: 'Urgent', normal: 'Normal', low: 'Low' } as const;

/** @pure The projects that have something on the board. */
export function boardProjects(board: HomeTaskBoard) {
	return board.counts
		.filter(({ todo, progress, blocked, done }) => todo + progress + blocked + done > 0)
		.map(({ project }) => project);
}

/** @pure The four columns for one project, or for all of them when none is chosen. */
export function boardColumns(board: HomeTaskBoard, project: string): HomeBoardColumnView[] {
	const counts = board.counts.filter((entry) => !project || entry.project === project);
	const cards = board.cards.filter((card) => !project || card.project === project);
	return columns.map((column) => ({
		...column,
		total: counts.reduce((sum, entry) => sum + entry[column.id], 0),
		cards: cards.filter((card) => card.column === column.id)
	}));
}

/** @pure The short id Tracker shows for an item. */
export function shortItemId(id: string) {
	return id.slice(0, 6);
}

/** @pure Who has it. A running card names the model and computer; others the owner, else model. */
export function boardCardWho(card: HomeBoardCard, column: HomeBoardColumn = card.column) {
	const { owner, model, computer } = card.row;
	if (column === 'progress')
		return `${model ?? 'Model not reported'} · ${computer ?? 'Computer not reported'}`;
	return [owner ?? 'No owner', model].filter(Boolean).join(' · ');
}

/** @pure Why there is no board to show, or null when there is one. */
export function boardNotice(reading: LinkedHome | null): string | null {
	const overview = reading?.snapshot?.liveOverview;
	if (overview?.board) return null;
	return liveNotice(reading) ?? 'Update Harness on your Mac to see the board.';
}
