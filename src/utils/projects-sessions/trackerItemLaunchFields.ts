// @harness-uid u_4pgfvaopdt
import type { TrackerItemInput } from './normalizeTrackerItemFields.types';
import type {
	TrackerItemMutationContext,
	TrackerItemSnapshot
} from './planTrackerItemMutation.types';
import { requestsTrackerLaunch } from './normalizeTrackerItemFields';
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
	if (fields.every || (fields.every === undefined && current?.every))
		throw trackerItemError('a reminder uses a scheduled time');
	const at = current
		? fields.remind_at
		: normalizeTrackerReminder(fields.remind_at ?? fields.due, now);
	return {
		...fields,
		remind_at: at,
		...(fields.kind === 'reminder' && trackerReminderLaunchFields)
	};
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
	const plan = context.planLaunch(fields, current);
	if (context.explicitLaunch || (current?.auto && plan.auto === current.auto)) return plan;
	return { ...plan, launch_source: 'automatic' };
}
