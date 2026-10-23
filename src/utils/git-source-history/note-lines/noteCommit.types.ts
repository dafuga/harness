import type { HistoryNote } from '../../../core/git-source-history/historyTypes';

export interface ReadNote {
	/** Valid entries that were written for this commit. */
	entries: HistoryNote[];
	problems: string[];
}
