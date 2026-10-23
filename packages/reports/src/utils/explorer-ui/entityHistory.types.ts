export interface HistoryTiming {
	profile: string;
	workload: string;
	metric: string;
	target: string | null;
	unit: string;
	/** The value of the same profile at the commit listed before; never another profile's. */
	before?: number;
	after: number;
}
