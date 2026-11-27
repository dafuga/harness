// @harness-uid u_vpe7qzi4gu
import type {
	TrackerRunDetailInput,
	TrackerRunDetailValue,
	TrackerRunRecord
} from './projectOverviewTracker.types';

/** What Home shows of a run beyond its state. A value this reader cannot use is left unreported. */
export function trackerRunDetail(row: TrackerRunDetailInput): Partial<TrackerRunRecord> {
	const time = (value: TrackerRunDetailValue) =>
		typeof value === 'number' && value > 0 ? value : null;
	const word = (value: TrackerRunDetailValue) =>
		typeof value === 'string' && value ? value : null;
	return {
		queued_at: time(row.queued_at),
		started_at: time(row.started_at),
		outcome: word(row.outcome),
		model: word(row.model),
		effort: word(row.effort),
		auto_token: word(row.auto_token),
		failure_reason: word(row.failure_reason)
	};
}
