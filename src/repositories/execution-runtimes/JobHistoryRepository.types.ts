// @harness-uid u_tjf4wq5l2c
export interface JobKey {
	id: string;
	source: string;
	attempt: number;
}
export interface JobStart extends JobKey {
	unit: string;
	type: string;
	model: string;
	startedAt: number;
	timingSource?: string;
}
export interface JobEnd extends JobKey {
	endedAt: number;
	outcome: 'pass' | 'fail' | 'cancelled';
}
export interface JobRecord extends JobStart {
	endedAt?: number;
	durationMs?: number;
	outcome?: 'pass' | 'fail' | 'cancelled';
}
