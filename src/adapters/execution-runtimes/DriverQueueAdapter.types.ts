// @harness-uid u_ew2a54dglc
export interface DriverProcess {
	model: string;
	slot: string;
	wave: string;
	tasksFile: string;
}
export interface DriverQueueAdapterConfig {
	root?: string;
	statusDir?: string;
	processes?: DriverProcess[];
}
export interface DriverActiveJob {
	model: string;
	unit?: string;
	task: string;
	kind?: string;
	slot?: string | number;
	pid?: number;
	started?: string;
	started_ts?: number;
}
export interface DriverTotals {
	planned: number;
	done: number;
	pass: number;
	fail: number;
	remaining: number;
}
export interface DriverActive {
	active: DriverActiveJob[];
	totals: DriverTotals;
	reverify_totals: DriverTotals;
	counts: { luna: number; haiku: number; total: number; reverify: number };
	updated: string;
}
