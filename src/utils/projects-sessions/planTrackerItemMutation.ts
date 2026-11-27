// @harness-uid u_4pgfvaopdt
import { normalizeTrackerItemFields } from './normalizeTrackerItemFields';
import type { TrackerItemFields, TrackerItemInput } from './normalizeTrackerItemFields.types';
import type {
	TrackerItemAction,
	TrackerItemMutation,
	TrackerItemMutationContext,
	TrackerItemMutationPlan,
	TrackerItemSnapshot
} from './planTrackerItemMutation.types';
import { trackerIsoTime } from './normalizeTrackerDue';
import { trackerItemError } from './trackerItemError';
import { trackerItemInput } from './trackerItemInput';
import { trackerItemTransitions } from './trackerItemTransitions';

export type {
	TrackerItemMutation,
	TrackerItemMutationContext,
	TrackerItemMutationPlan,
	TrackerItemSnapshot
} from './planTrackerItemMutation.types';

/** Derive one journal write from a resolved row or reserved item ID and one clock reading. */
export function planTrackerItemMutation<Receipt extends object>(
	request: TrackerItemMutation<Receipt>,
	context: TrackerItemMutationContext
): TrackerItemMutationPlan<Receipt> {
	const body = request.body ?? {};
	const itemId = request.action === 'add' ? request.itemId : request.item.id;
	const fields =
		request.action === 'add'
			? createFields(body, context)
			: updateFields(request.action, request.item, body, context);
	return { itemId, fields, ...(request.receipt === undefined ? {} : { receipt: request.receipt }) };
}

function updateFields(
	action: TrackerItemAction,
	item: TrackerItemSnapshot,
	body: TrackerItemInput,
	context: TrackerItemMutationContext
): TrackerItemFields {
	const change =
		action === 'update'
			? { fields: trackerItemInput(body, context, item), appendNote: body.append_note }
			: trackerItemTransitions[action](item, body, context);
	const fields = normalizeTrackerItemFields(change.fields, context);
	if (action !== 'move-on') guardNextStep(fields, item);
	if (endsReminder(fields, (fields.kind ?? item.kind) === 'reminder')) fields.remind_at = null;
	if (change.appendNote) fields['note+'] = String(change.appendNote);
	if (Object.keys(fields).length === 0) throw trackerItemError('nothing to update');
	return fields;
}

function guardNextStep(fields: TrackerItemFields, item?: TrackerItemSnapshot): void {
	if (!(fields.next_step ?? item?.next_step)) return;
	if (fields.every ?? item?.every)
		throw trackerItemError('recurring items cannot have a next step');
	if (fields.status === 'ignored' || fields.needs_daniel === 0 || fields.deleted === 1)
		throw trackerItemError('Daniel can close the next step with tracker move-on', 409);
}

function endsReminder(fields: TrackerItemFields, reminder: boolean): boolean {
	return (
		(!reminder && (fields.resolved === 1 || fields.needs_daniel === 0)) ||
		fields.status === 'done' ||
		fields.status === 'ignored' ||
		fields.deleted === 1
	);
}

function createFields(
	body: TrackerItemInput,
	context: TrackerItemMutationContext
): TrackerItemFields {
	const fields = normalizeTrackerItemFields(trackerItemInput(body, context), context);
	if (!fields.title) throw trackerItemError('title is required');
	guardNextStep(fields);
	return {
		kind: 'task',
		status: 'open',
		needs_daniel: 0,
		resolved: 0,
		deleted: 0,
		created_at: trackerIsoTime(context.now),
		created_by: context.node,
		...fields
	};
}
