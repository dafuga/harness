// @harness-uid u_7ryrqak22k
import type { TrackerItemRow } from './TrackerItemReadRepository.types';
import type { TrackerWebhookEnqueue } from '../../services/projects-sessions/TrackerNotificationService.types';

export type TrackerRecurringItem = TrackerItemRow & { every: string };
export type TrackerRecurringWake = Extract<TrackerWebhookEnqueue, { kind: 'recurring_due' }>;

export interface TrackerRecurringResult {
	occurrence: string;
	status: 'done' | 'failed';
	at: string | null;
	note: string | null;
	by: string | null;
}

export type TrackerOccurrenceRow = Omit<TrackerRecurringResult, 'at' | 'status'> & {
	status: TrackerRecurringResult['status'] | 'missed' | 'pending';
	fired_at: string | null;
	result_at: string | null;
};

export interface TrackerRecurringPlan {
	spec: string;
	fields: Record<string, unknown>;
	wake?: TrackerRecurringWake;
	missed?: readonly string[];
}

export interface TrackerRecurringJob {
	item_id: string;
	wake_on: 'finding' | 'fail' | 'always';
	timeout_s: number;
	updated_at: number;
}

export type TrackerRecurringWork =
	| { phase: 'wake'; wake: TrackerRecurringWake }
	| { phase: 'queued' | 'claimed'; wake: TrackerRecurringWake; job: TrackerRecurringJob };
