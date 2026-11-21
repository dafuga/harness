// @harness-uid u_xba7ieg4je
import type {
	TrackerDigest,
	TrackerDigestItem,
	TrackerItemRow,
	TrackerRecurringProblem
} from '../TrackerItemReadRepository.types';
import type { StoredRecurringResult } from './buildTrackerDigest.types';

/** Group active items by the configured calendar day and current recurring outcome. */
export function buildTrackerDigest(
	rows: TrackerItemRow[],
	nowMs: number,
	timeZone: string
): TrackerDigest {
	const localTime = stamp(nowMs, timeZone);
	const [today] = localTime.split(' ');
	const blocked: TrackerDigestItem[] = [];
	const needs_daniel: TrackerDigestItem[] = [];
	const overdue: TrackerDigestItem[] = [];
	const due_today: TrackerDigestItem[] = [];
	const recurring_missed: TrackerRecurringProblem[] = [];
	for (const row of rows) {
		const item = summarize(row);
		if (row.status === 'blocked') blocked.push(item);
		if (item.needs_daniel) needs_daniel.push(item);
		if (row.every) {
			const problem = recurringProblem(row, row.every, item, timeZone);
			if (problem) recurring_missed.push(problem);
		} else if (row.due) {
			const day =
				row.due.length === 10 ? row.due : stamp(Date.parse(row.due), timeZone).split(' ')[0];
			if (day < today) overdue.push(item);
			if (day === today) due_today.push(item);
		}
	}
	return {
		generated_at: new Date(nowMs).toISOString(),
		local_time: `${localTime} ${timeZone}`,
		today,
		blocked,
		needs_daniel,
		overdue,
		due_today,
		recurring_missed,
		counts: {
			blocked: blocked.length,
			needs_daniel: needs_daniel.length,
			overdue: overdue.length,
			due_today: due_today.length,
			recurring_missed: recurring_missed.length
		}
	};
}

function summarize(row: TrackerItemRow): TrackerDigestItem {
	return {
		id: row.id,
		kind: row.kind,
		title: row.title,
		status: row.status,
		blocked_reason: row.status === 'blocked' ? row.blocked_reason : null,
		needs_daniel: Boolean(row.needs_daniel) && !row.resolved,
		due: row.due,
		owner: row.owner,
		agent: row.agent,
		question: row.question,
		created_by: row.created_by,
		updated_at: row.updated_at
	};
}

function recurringProblem(
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
		missed_local: missed ? stamp(Date.parse(missed), displayZone) : null,
		failed,
		failed_local: failed ? stamp(Date.parse(failed.occurrence), displayZone) : null
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

function stamp(ms: number, timeZone: string): string {
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
