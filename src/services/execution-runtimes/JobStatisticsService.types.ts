// @harness-uid u_u6mg7e66nj
export interface DurationSummary {
	type: string;
	model: string;
	count: number;
	meanMs: number;
	medianMs: number;
	p80Ms: number;
	p90Ms: number;
}
export interface DurationEstimate extends DurationSummary {
	fallback: 'exact' | 'model' | 'type' | 'global';
	conditionalCount: number;
	tailExtrapolated: boolean;
}
