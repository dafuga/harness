// @harness-uid u_ycw5bvew23
import type {
	HomeBoardCard,
	HomeBoardColumn
} from '$reports/lib/projects-sessions/hub-home/homeBoard.types';
import type { HomeOpenAsk } from '$reports/lib/projects-sessions/hub-home/hubHome.types';

/** A card with the open question it waits on, when it has one. */
export type BoardViewCard = HomeBoardCard & { ask?: HomeOpenAsk };

export interface BoardFilter {
	/** Empty for every project. */
	project: string;
	search: string;
}

export interface BoardViewColumn {
	id: HomeBoardColumn;
	label: string;
	cards: BoardViewCard[];
	total: number;
}

export interface BoardView {
	columns: BoardViewColumn[];
	/** Projects with unfinished work, busiest first. */
	projects: { name: string; total: number }[];
	open: number;
	/** The linked Mac sends no full board: To do lists only queued work, Done only today's. */
	partial: boolean;
	unlistedOpen: number;
}
