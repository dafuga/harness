export interface MeasureRow {
	label: string;
	value: string;
	rawValue?: number | null;
	unitOfMeasure?: string;
	/** Emitted artifact target; none means no output-size metric applies. */
	target?: string;
	/** Why there is no value, or what the value leaves out. */
	note?: string;
}

export interface PerformanceRow {
	workload: string;
	metric: string;
	/** The execution target the timing was taken on; empty when it names none. */
	target: string;
	/** The machine profile the timing was taken under; empty when nothing was measured. */
	profile: string;
	value: string;
	rawValue?: number | null;
	unitOfMeasure?: string;
	note?: string;
	tolerance: string;
	/** True when the declared tolerance is looser than the policy allows. */
	over: boolean;
}

export interface EntityMeasure {
	size: MeasureRow[];
	performance: PerformanceRow[];
}
