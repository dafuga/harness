// @harness-uid u_ewas4mssnh
import type { TrackerItemInput, TrackerItemValue } from './normalizeTrackerItemFields.types';
import type {
	TrackerItemChange,
	TrackerItemMutationContext,
	TrackerItemSnapshot
} from './planTrackerItemMutation.types';
import { trackerIsoTime, trackerLocalStamp, trackerTimeZone } from './normalizeTrackerDue';
import { normalizeTrackerCron, trackerCronOccurrences } from './normalizeTrackerCron';
import { trackerItemError } from './trackerItemError';
import { trackerItemValueOr } from './trackerItemValueOr';

/** Record one recurring occurrence's done or failed result and reopen the item for the next. */
export function finishTrackerOccurrence(
	item: TrackerItemSnapshot,
	body: TrackerItemInput,
	context: TrackerItemMutationContext
): TrackerItemChange {
	const occurrence = body.occurrence ? parseOccurrence(body.occurrence) : item.occurrence;
	if (!occurrence) {
		throw trackerItemError('no occurrence of this recurring item has come due yet');
	}
	const stamp = trackerLocalStamp(
		Date.parse(occurrence),
		trackerItemValueOr(item.every_tz, trackerTimeZone)
	);
	const status = body.failed ? 'failed' : 'done';
	const result = {
		occurrence,
		status,
		at: trackerIsoTime(context.now),
		by: trackerItemValueOr(body.by, context.node),
		note: trackerItemValueOr(body.note, null)
	};
	const reopen = item.status === 'in_progress' || item.status === 'done';
	return {
		fields: { last_result: result, ...(reopen ? { status: 'open' } : {}) },
		appendNote: `occurrence ${stamp} ${status}${body.note ? `: ${body.note}` : ''}`
	};
}

/** The first scheduled time of a repeating reminder after the given instant. */
export function nextTrackerReminder(
	every: TrackerItemValue,
	timeZone: TrackerItemValue,
	after: number
): string {
	const zone = String(trackerItemValueOr(timeZone, trackerTimeZone));
	const cron = normalizeTrackerCron(every, zone, after);
	return trackerIsoTime(trackerCronOccurrences(cron, zone)(after));
}

/**
 * Done on a repeating reminder arms the next scheduled time and keeps the item open. Done before
 * the armed time skips that time. `occurrence` names the armed time a button showed, so a second
 * tap cannot skip another one.
 */
export function finishTrackerReminder(
	item: TrackerItemSnapshot,
	body: TrackerItemInput,
	context: TrackerItemMutationContext
): TrackerItemChange {
	if (body.failed) throw trackerItemError('--failed is only for recurring jobs');
	const armed = Date.parse(item.remind_at ?? '') || 0;
	if (body.occurrence && Date.parse(parseOccurrence(body.occurrence)) !== armed)
		throw trackerItemError('this reminder has already moved to another time', 409);
	const next = nextTrackerReminder(item.every, item.every_tz, Math.max(context.now, armed));
	const zone = String(trackerItemValueOr(item.every_tz, trackerTimeZone));
	return {
		fields: { remind_at: next, ...(item.status !== 'open' && { status: 'open' }) },
		appendNote: `reminder done; next ${trackerLocalStamp(Date.parse(next), zone)} ${zone}${
			body.note ? `: ${body.note}` : ''
		}`
	};
}

function parseOccurrence(value: unknown): string {
	const time = Date.parse(value as string);
	if (Number.isNaN(time)) throw trackerItemError(`bad occurrence time "${value}"`);
	return trackerIsoTime(time);
}
