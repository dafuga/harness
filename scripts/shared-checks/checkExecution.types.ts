// @harness-uid u_sbz3zzk4fx
import type { CheckQueue } from './checkQueue';
import type { CheckResult } from './sharedCheck.types';

export type CheckOutcome = Omit<CheckResult, 'batch'>;

export interface CheckSnapshot {
	directory: string;
	queue: CheckQueue;
	signal: AbortSignal;
	env: Record<string, string | undefined>;
	track: (pid: number) => void;
}
