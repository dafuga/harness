// @harness-uid u_znhiskysf2
import { z } from 'zod';
import type { JobKey, JobRecord } from '../JobHistoryRepository.types';
const schema = z.object({
	id: z.string().min(1),
	source: z.string().min(1),
	attempt: z.number().int().positive(),
	unit: z.string().min(1),
	type: z.string().min(1),
	model: z.string().min(1),
	startedAt: z.number().finite().nonnegative(),
	endedAt: z.number().finite().nonnegative().optional(),
	durationMs: z.number().finite().nonnegative().optional(),
	outcome: z.enum(['pass', 'fail', 'cancelled']).optional(),
	timingSource: z.string().optional()
});
/** Validates complete lifecycle pairs before a transaction writes any bytes. */
export function jobRecord(input: JobRecord): JobRecord {
	const record = schema.parse(input);
	if (record.endedAt !== undefined) {
		if (
			!record.outcome ||
			record.endedAt < record.startedAt ||
			record.durationMs !== record.endedAt - record.startedAt
		)
			throw new RangeError('Invalid completed job timing');
	} else if (record.outcome !== undefined || record.durationMs !== undefined)
		throw new RangeError('Incomplete job timing');
	return record;
}
/** @pure Stable source and attempt identity prevents duplicate imports and retries. */
export function jobKey(key: JobKey): string {
	return JSON.stringify([key.source, key.id, key.attempt]);
}
