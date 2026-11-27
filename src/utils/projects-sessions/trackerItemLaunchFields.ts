// @harness-uid u_4pgfvaopdt
import type { TrackerItemInput } from './normalizeTrackerItemFields.types';
import type {
	TrackerItemMutationContext,
	TrackerItemSnapshot
} from './planTrackerItemMutation.types';
import { clearsTrackerRecurrence, requestsTrackerLaunch } from './normalizeTrackerItemFields';
import { nextTrackerReminder } from './finishTrackerOccurrence';
import { normalizeTrackerReminder } from './normalizeTrackerDue';
import { trackerItemError } from './trackerItemError';

export const trackerReminderLaunchFields = {
	auto: null,
	launch_target: null,
	launch_source: null,
	launch_pick: null,
	schedule_off: 1
} as const;

function reminderInput(
	fields: TrackerItemInput,
	current: TrackerItemSnapshot | undefined,
	now: number
) {
	if (requestsTrackerLaunch(fields.auto)) throw trackerItemError('reminders cannot launch');
	const at = reminderTime(fields, current, now);
	return {
		...fields,
		remind_at: at,
		...(fields.kind === 'reminder' && trackerReminderLaunchFields)
	};
}

/** A repeating reminder with no given time is armed at its next scheduled one. */
function reminderTime(
	fields: TrackerItemInput,
	current: TrackerItemSnapshot | undefined,
	now: number
) {
	const given = current ? fields.remind_at : (fields.remind_at ?? fields.due);
	const next = given === undefined ? scheduledTime(fields, current, now) : undefined;
	if (next) return next;
	return current ? fields.remind_at : normalizeTrackerReminder(given, now);
}

/** The next time to arm, when a new schedule or an unarmed repeating item needs one. */
function scheduledTime(
	fields: TrackerItemInput,
	current: TrackerItemSnapshot | undefined,
	now: number
) {
	if (fields.every === undefined && current?.remind_at) return undefined;
	const every = fields.every === undefined ? current?.every : fields.every;
	if (!every || clearsTrackerRecurrence(every)) return undefined;
	return nextTrackerReminder(every, fields.every_tz ?? current?.every_tz, now);
}

export function trackerItemLaunchFields(
	fields: TrackerItemInput,
	context: TrackerItemMutationContext,
	current?: TrackerItemSnapshot
) {
	if ((fields.kind ?? current?.kind) === 'reminder')
		return reminderInput(fields, current, context.now);
	if (!requestsTrackerLaunch(fields.auto)) return fields;
	if (!context.planLaunch)
		throw new TypeError('Tracker launch planning requires a placement collaborator');
	return context.planLaunch(fields, current);
}
