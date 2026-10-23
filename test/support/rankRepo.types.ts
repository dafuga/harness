export interface PerformanceEntry {
	workload: string;
	metric: string;
	profile: string;
	value: number;
	unitOfMeasure: string;
	method: string;
	comparison: {
		request: string;
		boundary: string;
		protocol: string;
		sampling: { warmup: number; rounds: number; iterations: number };
	};
}
