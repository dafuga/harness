// @harness-uid u_ycwbrdtyps
import type { HomeWorkRow } from './homeLive.types';
import type { IncludedTrackerItem } from '../project-overview/projectOverviewTracker.types';

export type HomeBoardColumn = 'todo' | 'progress' | 'blocked' | 'done';

export type HomeBoardPriority = 'urgent' | 'normal' | 'low';

/** One Tracker item on the board. Its row is what the item detail shows. */
export interface HomeBoardCard {
	column: HomeBoardColumn;
	project: string;
	priority: HomeBoardPriority;
	/** An open structured ask: Daniel's decision is what the item waits for. */
	needsYou: boolean;
	/** The state in words, such as Running, Queued #3 or Launch paused. */
	label: string;
	/** Why a blocked item is blocked, as one line; null elsewhere. */
	reason: string | null;
	row: HomeWorkRow;
}

/** Every item of one project by column, counted before the card limit. */
export type HomeBoardCount = { project: string } & Record<HomeBoardColumn, number>;

export interface HomeTaskBoard {
	/** Each column in its own order, at most a fixed number per project. */
	cards: HomeBoardCard[];
	counts: HomeBoardCount[];
}

/** One listed item with the Live overview rows it has now. */
export interface HomeBoardWork {
	item: IncludedTrackerItem;
	rows: HomeWorkRow[];
	/** The row of an item that has none in the Live overview. */
	resting: HomeWorkRow;
}
