// @harness-uid u_ycw5btyp23
import type { HomeWorkRow } from './homeLive.types';

export type HomeBoardColumn = 'todo' | 'progress' | 'blocked' | 'done';

export interface HomeBoardNote {
	at: string;
	text: string;
}

/** The newest pull request a task's notes link, and whether a note says it merged. */
export interface HomeBoardPr {
	number: number;
	url: string;
	merged?: true;
}

/** One Tracker item on the board. */
export interface HomeBoardCard {
	column: HomeBoardColumn;
	project: string;
	row: HomeWorkRow;
	priority?: 'urgent' | 'normal' | 'low';
	/** The item's due time, which is the ETA of running work. */
	due?: string | null;
	pr?: HomeBoardPr;
	notes?: HomeBoardNote[];
}

/** Every item of one project by column, counted before the card limit. */
export type HomeBoardCount = { project: string } & Record<HomeBoardColumn, number>;

export interface HomeBoard {
	cards: HomeBoardCard[];
	counts: HomeBoardCount[];
}
