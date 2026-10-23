export interface Boundary {
	unit: string;
	workload: string;
	measurements: Array<{
		unit: string;
		metric: string;
		value: number;
		target: string;
		workload: string;
		method: string;
		samples: number;
		comparison?: { request: string; boundary: string; sampling: object };
	}>;
}
