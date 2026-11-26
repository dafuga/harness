// @harness-uid u_3orvy5t47h
import type {
	TrackerDigestItem,
	TrackerRecurringProblem
} from '../TrackerItemReadRepository.types';
import type { TrackerItemRow } from '../TrackerItemReadRepository.types';
import type { StoredRecurringResult } from './buildTrackerDigest.types';

/** The unresolved miss or current failure of a recurring item, if either is outstanding. */
export function trackerRecurringProblem(
	row: TrackerItemRow,
	every: string,
	item: TrackerDigestItem,
	timeZone: string
): TrackerRecurringProblem | null {
	const result = recurringResult(row.last_result);
	const missed = unresolvedMiss(row.missed, result);
	const failed = currentFailure(row.occurrence, result);
	if (!missed && !failed) return null;
	const occurrenceZone = row.every_tz === '' ? null : row.every_tz;
	const displayZone = occurrenceZone ?? timeZone;
	return {
		...item,
		every,
		every_tz: occurrenceZone ?? 'Europe/Lisbon',
		missed,
		missed_local: missed ? trackerDigestStamp(Date.parse(missed), displayZone) : null,
		failed,
		failed_local: failed ? trackerDigestStamp(Date.parse(failed.occurrence), displayZone) : null
	};
}

function unresolvedMiss(
	missed: string | null,
	result: StoredRecurringResult | null
): string | null {
	if (!missed) return null;
	if (result?.status === 'done' && result.occurrence && result.occurrence > missed) return null;
	return missed;
}

function currentFailure(
	occurrence: string | null,
	result: StoredRecurringResult | null
): TrackerRecurringProblem['failed'] {
	if (result?.status !== 'failed' || result.occurrence !== occurrence) return null;
	const note = result.note === '' ? null : (result.note ?? null);
	return { occurrence: result.occurrence, note };
}

function recurringResult(raw: string | null): StoredRecurringResult | null {
	try {
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

const formatters = new Map<string, Intl.DateTimeFormat>();

export function trackerDigestStamp(ms: number, timeZone: string): string {
	let formatter = formatters.get(timeZone);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat('en-US', {
			timeZone,
			hourCycle: 'h23',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
		formatters.set(timeZone, formatter);
	}
	const { year, month, day, hour, minute } = Object.fromEntries(
		formatter.formatToParts(ms).map(({ type, value }) => [type, value])
	);
	return `${year}-${month}-${day} ${hour}:${minute}`;
}
