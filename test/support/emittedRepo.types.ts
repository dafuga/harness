export interface EmittedFinding {
	unit: string;
	metric: string;
	target?: string;
	status: string;
	baseline: number | null;
	measured: number | null;
	detail?: string;
}

export interface LedgerEvent {
	type: string;
	unit: string;
	metrics?: Record<string, number>;
	before?: Record<string, number>;
	after?: Record<string, number>;
	unmeasured?: Record<string, string>;
}
