// @harness-uid u_zqftrauna4
import type { DurationEstimate } from './JobStatisticsService.types';
export interface QueueJob {
	id?: string;
	model: string;
	type: string;
	startedAt?: number;
}
export interface QueueSnapshot {
	queued: QueueJob[];
	running: QueueJob[];
	slots: Record<string, number>;
	warnings?: string[];
}
export interface QueueEstimate {
	status: 'estimated' | 'blocked' | 'unknown' | 'empty';
	queued: number;
	running: number;
	slots: Record<string, number>;
	p50Ms: number | null;
	p90Ms: number | null;
	finish: { p50: string | null; p90: string | null };
	estimates: DurationEstimate[];
	warnings: string[];
}

export interface ScheduleContext {
	queue: QueueSnapshot;
	now: number;
	result: QueueEstimate;
	upper: boolean;
	lanes: Map<string, number[]>;
}
