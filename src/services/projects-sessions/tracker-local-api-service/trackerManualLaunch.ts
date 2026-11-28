// @harness-uid u_g7kdpz7bel
import { trackerReminderTitle } from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import type { TrackerItemSnapshot } from '../../../utils/projects-sessions/planTrackerItemMutation.types';
import type { TrackerItemInput } from '../../../utils/projects-sessions/normalizeTrackerItemFields.types';
import { normalizeTrackerItemFields } from '../../../utils/projects-sessions/normalizeTrackerItemFields';
import { planTrackerItemMutation } from '../../../utils/projects-sessions/planTrackerItemMutation';
import type { TrackerItemMutationContext } from '../../../utils/projects-sessions/planTrackerItemMutation.types';
import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';

export function isTrackerManualLaunch(verb: string | undefined): boolean {
	return verb === 'launch' || verb === 'unlaunch' || verb === 'schedule-on';
}

export function planTrackerManualLaunch(
	verb: string,
	item: TrackerItemSnapshot,
	body: TrackerItemInput,
	context: TrackerItemMutationContext
) {
	if (verb !== 'launch') {
		const off = verb === 'unlaunch';
		return {
			itemId: item.id,
			fields: {
				...(off && { auto: null, launch_target: null, launch_source: null, launch_pick: null }),
				schedule_off: off ? 1 : 0,
				schedule_hold_reason: off ? 'Automatic launch paused by operator' : null,
				schedule_status: null,
				'note+': off ? 'auto-launch turned off for 24 hours' : 'automatic due launch allowed'
			}
		};
	}
	return planTrackerExplicitLaunch(item, body, context);
}

function planTrackerExplicitLaunch(
	item: TrackerItemSnapshot,
	body: TrackerItemInput,
	context: TrackerItemMutationContext
) {
	guardManualLaunch(item);
	const { project, repo, computer, model, sensitive } = body;
	const reset = item.status === 'blocked' || item.status === 'done';
	const plan = planTrackerItemMutation(
		{
			action: 'update',
			item,
			body: { project, repo, computer, model, sensitive, auto: true }
		},
		context
	);
	if (plan.fields.auto === item.auto) return { itemId: item.id, fields: null };
	const modelLabel = model ? ` (model ${model})` : '';
	plan.fields['note+'] = `auto-launch requested on ${plan.fields.launch_target}${modelLabel}`;
	if (reset)
		Object.assign(
			plan.fields,
			normalizeTrackerItemFields(
				{
					status: 'open',
					needs_daniel: 0
				},
				context
			)
		);
	return plan;
}

function guardManualLaunch(item: TrackerItemSnapshot) {
	if (item.kind === 'reminder' || trackerReminderTitle(item.title ?? ''))
		throw trackerItemError('reminders cannot launch', 409);
	if (item.status === 'ignored') throw trackerItemError('item is ignored', 409);
	if (item.status === 'blocked' && item.needs_daniel && !item.resolved)
		throw trackerItemError(
			`waiting on Daniel (flagged). Review with tracker show ${item.id}.`,
			409
		);
}
