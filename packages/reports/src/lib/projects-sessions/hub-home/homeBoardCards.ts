// @harness-uid u_ycw5bcrd23
import { isWithin, WEEK_MS } from '../project-overview/projectOverviewItems';
import type { IncludedTrackerItem } from '../project-overview/projectOverviewTracker.types';
import { homeText } from './homeTrackerText';
import type { HomeBoard, HomeBoardCard, HomeBoardColumn, HomeBoardCount } from './homeBoard.types';
import type { HomeWorkRow } from './homeLive.types';

/** Cards sent for one project in one column; the counts still include every item. */
export const homeBoardCardsPerProject = 15;
const pullLink = /https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/(\d+)/g;
const priorities = ['urgent', 'normal', 'low'] as const;

/** @pure The column a listed row belongs in. */
export function homeBoardColumn(row: HomeWorkRow): HomeBoardColumn {
	if (row.status === 'done') return 'done';
	if (row.state === 'running') return 'progress';
	if (row.state === 'offline') return 'blocked';
	return row.state === 'blocked' && !row.launchHold ? 'blocked' : 'todo';
}

/** @pure The newest pull request linked in notes, oldest first. */
function pullRequest(notes: { text: string }[]): HomeBoardCard['pr'] {
	for (const note of [...notes].reverse()) {
		const found = [...note.text.matchAll(pullLink)].at(-1);
		if (!found) continue;
		const number = Number(found[1]);
		const merged = new RegExp(
			`merged[^.]{0,60}(#|pull/)${number}\\b|(#|pull/)${number}\\b[^.]{0,60}\\bmerged`,
			'i'
		);
		return {
			number,
			url: found[0],
			...(notes.some((n) => merged.test(n.text)) && { merged: true as const })
		};
	}
}

/** One listed item with its first (most pressing) row. */
export interface HomeBoardWork {
	item: IncludedTrackerItem;
	row: HomeWorkRow;
}

function latestNotes(notes: { at: string; text: string }[]) {
	return notes
		.slice(-2)
		.reverse()
		.map((note) => ({ at: new Date(note.at).toISOString(), text: homeText(note.text, 180) ?? '' }))
		.filter((note) => note.text);
}

function boardCard({ item, row }: HomeBoardWork): HomeBoardCard {
	const notes = item.notes_log ?? [];
	const pr = pullRequest(notes);
	return {
		column: homeBoardColumn(row),
		project: homeText(item.project || item.agent, 200) ?? 'No project',
		row,
		priority: priorities.find((priority) => priority === item.priority) ?? 'normal',
		due: item.due ? new Date(item.due).toISOString() : null,
		...(pr && { pr }),
		// A week of finished work would triple the answer with notes few people open.
		...(row.status !== 'done' && { notes: latestNotes(notes) })
	};
}

/** @pure Most urgent first, then the newest change. Done is newest first. */
export function compareHomeBoardCards(a: HomeBoardCard, b: HomeBoardCard) {
	const rank = (card: HomeBoardCard) =>
		card.column === 'done' ? 0 : priorities.indexOf(card.priority ?? 'normal');
	return (
		rank(a) - rank(b) ||
		b.row.updatedAt.localeCompare(a.row.updatedAt) ||
		a.row.key.localeCompare(b.row.key)
	);
}

/** @pure The board of the listed items; done keeps the last seven days. */
export function buildHomeBoard(works: HomeBoardWork[], now: number): HomeBoard {
	const all = works
		.filter(({ item }) => item.status !== 'done' || isWithin(item.updated_at, WEEK_MS, now))
		.map(boardCard)
		.sort(compareHomeBoardCards);
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
	return { cards, counts: [...counts.values()] };
}
