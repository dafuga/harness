// @harness-uid u_adwgoryfne
import type {
	TrackerRecurringItem,
	TrackerRecurringPlan
} from '../../../repositories/projects-sessions/TrackerRecurringRepository.types';
import { readRecurringResult } from '../../../repositories/projects-sessions/tracker-recurring-repository/recurringHistory';
import { trackerCronOccurrences } from '../../../utils/projects-sessions/normalizeTrackerCron';
import {
	trackerIsoTime,
	trackerLocalStamp,
	trackerTimeZone
} from '../../../utils/projects-sessions/normalizeTrackerDue';

const maxCatchUp = 1000;

export function planRecurringOccurrence(
	item: TrackerRecurringItem,
	now: number,
	previous?: string
): TrackerRecurringPlan | undefined {
	const { every, every_tz, due, id } = item;
	const zone = every_tz || trackerTimeZone;
	const spec = `${every}|${zone}`;
	const dueAt = due ? Date.parse(due) : NaN;
	if (previous === spec && dueAt > now) return;
	const next = trackerCronOccurrences(every, zone);
	if (previous !== spec || !Number.isFinite(dueAt)) {
		const scheduled = trackerIsoTime(next(now));
		return { spec, fields: due === scheduled ? {} : { due: scheduled } };
	}
	const { at, following, missed } = catchUp(dueAt, now, next);
	if (item.occurrence && readRecurringResult(item.last_result)?.occurrence !== item.occurrence) {
		missed.unshift(item.occurrence);
	}
	const stamp = (iso: string) => `${trackerLocalStamp(Date.parse(iso), zone)} ${zone}`;
	const occurrence = trackerIsoTime(at);
	const nextDue = trackerIsoTime(following);
	const fields: Record<string, unknown> = { occurrence, due: nextDue };
	if (missed.length) {
		fields.missed = missed.at(-1);
		fields['note+'] =
			`missed occurrence${missed.length > 1 ? 's' : ''}: ${missed.map(stamp).join(', ')}`;
	}
	const payload = {
		occurrence,
		occurrence_local: stamp(occurrence),
		every,
		every_tz: zone,
		notes: item.notes,
		next_due: nextDue,
		...(missed.length ? { missed } : {})
	};
	const wake = {
		kind: 'recurring_due' as const,
		key: `recurring_due|${id}|${occurrence}`,
		itemId: id,
		at,
		payload
	};
	return { spec, fields, wake, missed };
}

function catchUp(due: number, now: number, next: (after: number) => number) {
	const missed: string[] = [];
	let at = due;
	let following = next(at);
	while (following <= now && missed.length < maxCatchUp - 1) {
		missed.push(trackerIsoTime(at));
		at = following;
		following = next(at);
	}
	return { at, following, missed };
}
