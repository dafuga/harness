// @harness-uid u_6atknznspb
import { basename, dirname } from 'node:path';
import type { HistoricalIdentity } from './historicalRecord.types';
import type { JobRecord } from '../../../repositories/execution-runtimes/JobHistoryRepository.types';
import type { HistoricalResult } from '../JobBackfillService.types';
export function historicalIdentity(data: HistoricalResult, path: string): HistoricalIdentity {
	return {
		id: data.task ?? data.unit_id ?? data.unit ?? basename(dirname(path)),
		unit: data.unit_id ?? data.unit ?? data.task ?? basename(dirname(path))
	};
}
export function historicalOutcome(status?: string): 'pass' | 'fail' | 'cancelled' {
	if (status === 'pass' || status?.startsWith('pass-')) return 'pass';
	return status === 'cancelled' ? 'cancelled' : 'fail';
}

/** Preserve gate attempts separately instead of assigning all elapsed time to the winning model. */
export function historicalAttempts(record: JobRecord, data: HistoricalResult): JobRecord[] {
	if (record.type !== 'reverify' || !data.tried?.length) return [record];
	if (!data.tried.every((attempt) => Number.isFinite(attempt.seconds) && attempt.seconds! >= 0))
		return [record];
	const total = data.tried.reduce((sum, attempt) => sum + Math.round(attempt.seconds! * 1000), 0);
	let cursor = record.endedAt! - total;
	return data.tried.map((attempt, index) => {
		const durationMs = Math.round(attempt.seconds! * 1000),
			startedAt = cursor;
		cursor += durationMs;
		let status = attempt.status;
		if (attempt.ok === true) status = 'pass';
		if (attempt.ok === false) status = 'fail';
		return {
			...record,
			attempt: index + 1,
			model: attempt.model ?? record.model,
			startedAt,
			endedAt: cursor,
			durationMs,
			outcome: historicalOutcome(status),
			timingSource: 'file-mtime-minus-attempt-durations'
		};
	});
}
