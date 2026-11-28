// @harness-uid u_ycwbrdview
import type {
	HomeBoardCard,
	HomeBoardColumn
} from '$reports/lib/projects-sessions/hub-home/homeTaskBoard.types';

export interface HomeBoardColumnView {
	id: HomeBoardColumn;
	title: string;
	/** Shown beside the title, such as the Done window. */
	note: string | null;
	/** Every item in the column for the chosen project, listed or not. */
	total: number;
	cards: HomeBoardCard[];
	empty: string;
}
