export interface WarmResult {
	medianMs: number;
	opsPerSecond: number;
	iterations: number;
}

export interface RoundResult {
	/** Fastest single call: the most repeatable figure on a machine doing other work. */
	floorMs: number;
	/** Median of the round medians. */
	warmMs: number;
	opsPerSecond: number;
	samples: number;
}
