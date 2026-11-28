// @harness-uid u_rcoti7b7ii
/** One numbered strip tile: a label, a big number and one line of detail. */
export interface StripCount {
	label: string;
	value: number;
	/** Line under the number, such as "4 Claude · 3 Codex" or "Oldest waiting 2h 14m". */
	sub: string;
}

/** The two numbered tiles that also filter the board when pressed. */
export interface StripCounts {
	sessions: StripCount;
	needsYou: StripCount;
}
