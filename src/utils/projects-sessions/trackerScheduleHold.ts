// @harness-uid u_fsox5s2njk
import { trackerClockMilliseconds } from './nextTrackerClock';
import type { TrackerScheduleFields } from './trackerScheduleHold.types';

export const manualIntakeReason = 'External intake requires an explicit launch';

const holdDurationMs = 86_400_000;

/** @pure Read an active pause from the journal version that set the item opt-out. */
export function trackerScheduleHold(row: TrackerScheduleFields, now: number) {
	if (Number(row.schedule_off) !== 1) return null;
	const clocks = JSON.parse(row.clocks) as Record<string, string>;
	if (row.legacy_adapter_manual || row.schedule_hold_reason === manualIntakeReason)
		return { reason: manualIntakeReason, until: null };
	const changed = trackerClockMilliseconds(clocks.schedule_off ?? '');
	const since = changed || legacyScheduleTime(row);
	const expires = since + holdDurationMs;
	if (!(expires > now)) return null;
	const reason =
		clocks.schedule_hold_reason === clocks.schedule_off && row.schedule_hold_reason
			? row.schedule_hold_reason
			: 'Legacy automatic launch pause';
	return { reason, until: new Date(expires).toISOString() };
}

function legacyScheduleTime(row: TrackerScheduleFields) {
	return Date.parse(row.created_at ?? row.updated_at ?? '');
}

export function describeTrackerScheduleHold({
	reason,
	until
}: {
	reason: string;
	until: string | null;
}) {
	return until ? `${reason} until ${until}` : reason;
}
