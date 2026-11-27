// @harness-uid u_r7qgepnoax
import type { TrackerOccurrenceRow } from '../../../repositories/projects-sessions/TrackerRecurringRepository.types';

export function formatNativeTrackerHistory(rows: TrackerOccurrenceRow[]): string {
	return rows.map(occurrenceLine).join('\n') || '(no occurrences yet)';
}

function occurrenceLine({ occurrence, status, result_at, by, note }: TrackerOccurrenceRow): string {
	const result = result_at ? `  (${result_at}${by ? ` by ${by}` : ''})` : '';
	return `${occurrence}  ${status}${result}${note ? `  ${note}` : ''}`;
}
