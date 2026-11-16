// @harness-uid u_6atknznspb
import { basename, dirname } from 'node:path';
import type { HistoricalIdentity } from './historicalRecord.types';
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
