// @harness-uid u_ewas4mssnh
import type { TrackerItemInput } from './normalizeTrackerItemFields.types';
import type {
	TrackerItemChange,
	TrackerItemMutationContext,
	TrackerItemSnapshot
} from './planTrackerItemMutation.types';
import { trackerIsoTime, trackerLocalStamp, trackerTimeZone } from './normalizeTrackerDue';
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

function parseOccurrence(value: unknown): string {
	const time = Date.parse(value as string);
	if (Number.isNaN(time)) throw trackerItemError(`bad occurrence time "${value}"`);
	return trackerIsoTime(time);
}
