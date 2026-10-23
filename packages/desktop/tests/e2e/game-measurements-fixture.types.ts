export type Observation = {
	unit: string;
	metric: string;
	unitOfMeasure: string;
	value: number;
	workload: string;
	target: string;
	samples: number;
	method: string;
};

export type RuntimeInput = {
	units: string[];
	elapsed: number;
	heap: number;
	workload: string;
	navigation: number | null;
};
