export interface Measured {
	unit: string;
	metric: string;
	value: number | null;
	unavailable?: string;
	partial?: string;
}

export interface Finding {
	unit: string;
	metric: string;
	status: string;
	baseline: number | null;
	measured: number | null;
	detail?: string;
}

export interface LedgerLine {
	unit: string;
	metrics: Record<string, number>;
	unmeasured?: Record<string, string>;
}

export interface Growth {
	id: string;
	growth: Array<{ 'source-bytes'?: number; complexity?: number; notes?: Record<string, string> }>;
}
