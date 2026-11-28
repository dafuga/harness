// @harness-uid u_4pgfvaopdt
import { isTrackerPing, isTrackerCosMessage } from './isTrackerPing';
import type { TrackerItemInput, TrackerItemValue } from './normalizeTrackerItemFields.types';
import type {
	TrackerItemAction,
	TrackerItemChange,
	TrackerItemMutationContext,
	TrackerItemSnapshot,
	TrackerItemTransition
} from './planTrackerItemMutation.types';
import {
	normalizeTrackerDue,
	normalizeTrackerReminder,
	trackerIsoTime
} from './normalizeTrackerDue';
import { trackerReminderLaunchFields } from './trackerItemLaunchFields';
import { trackerItemError } from './trackerItemError';
import { trackerItemValueOr } from './trackerItemValueOr';
import { trackerAskTransitions } from './trackerAskTransitions';
import { trackerOpenDecision } from './trackerOpenDecision';
import {
	guardTrackerDuplicate,
	trackerMoveOn,
	trackerNextStepFields,
	trackerParkNextStep,
	trackerResolveItem
} from './trackerItemInput';
import { finishTrackerOccurrence, finishTrackerReminder } from './finishTrackerOccurrence';
const start = { status: 'in_progress' };

export const trackerItemTransitions: Record<
	Exclude<TrackerItemAction, 'update'>,
	TrackerItemTransition
> = {
	start: () => ({ fields: start }),
	reopen: () => ({ fields: { status: 'open' } }),
	remove: () => ({ fields: { deleted: 1 } }),
	block: blockItem,
	unblock: unblockItem,
	progress: (_, body) => appendText('progress', body.text, start),
	note: (_, body) => appendText('note', body.text, {}),
	flag: flagItem,
	chase: (_, body) => ({ fields: { 'chase+': body.note ?? null } }),
	park: trackerParkNextStep,
	'move-on': trackerMoveOn,
	priority: (_, body) => ({ fields: { priority: body.priority ?? null } }),
	remind: (item, body, context) => {
		if (item.status === 'done' || item.status === 'ignored')
			throw trackerItemError('only active items can be reminded', 409);
		const remind_at = normalizeTrackerReminder(body.at, context.now);
		if (!body.reminder) return { fields: { remind_at } };
		if (item.every && item.kind !== 'reminder')
			throw trackerItemError('this item repeats a job; remove --every before converting it');
		return { fields: { remind_at, kind: 'reminder', ...trackerReminderLaunchFields } };
	},
	answer: trackerAskTransitions.answer,
	unflag: () => ({ fields: { needs_daniel: 0 } }),
	resolve: trackerResolveItem,
	done: finishItem,
	ignore: ignoreItem,
	unignore: unignoreItem
};
/** A block records a dependency. Only `flag` asks Daniel, so blocking never does. */
function blockItem(_: TrackerItemSnapshot, body: TrackerItemInput): TrackerItemChange {
	const reason = String(trackerItemValueOr(body.reason, '')).trim();
	if (!reason) throw trackerItemError('block reason required');
	return {
		fields: { status: 'blocked', blocked_reason: reason },
		appendNote: `blocked: ${reason}`
	};
}

function unblockItem(item: TrackerItemSnapshot, body: TrackerItemInput): TrackerItemChange {
	if (item.status !== 'blocked') {
		throw trackerItemError(
			`item ${item.id.slice(0, 6)} is not blocked (status ${item.status})`,
			409
		);
	}
	return {
		fields: start,
		appendNote: body.note ? `unblocked: ${body.note}` : 'unblocked'
	};
}

function appendText(
	action: 'note' | 'progress',
	text: TrackerItemValue,
	fields: TrackerItemInput
): TrackerItemChange {
	if (!text) throw trackerItemError(`${action} text required`);
	return { fields, appendNote: text };
}

function flagItem(
	item: TrackerItemSnapshot,
	body: TrackerItemInput,
	context: TrackerItemMutationContext
): TrackerItemChange {
	if (body.question && isTrackerCosMessage(String(body.question)))
		return { fields: {}, appendNote: `for Chief of Staff: ${body.question}` };
	guardTrackerDuplicate(context, {
		text: `${item.title} ${trackerItemValueOr(body.question, item.question) ?? ''}`,
		agent: item.agent,
		excludeId: item.id,
		force: body.force,
		askingDaniel: true
	});
	return {
		fields: {
			needs_daniel: 1,
			resolved: 0,
			...(body.question ? { question: body.question } : {}),
			...trackerAskTransitions.choiceFields(item, body)
		}
	};
}

function finishItem(
	item: TrackerItemSnapshot,
	body: TrackerItemInput,
	context: TrackerItemMutationContext
): TrackerItemChange {
	if (item.every && body.next_step !== undefined)
		throw trackerItemError('recurring items cannot have a next step');
	if (item.kind === 'reminder' && item.every) return finishTrackerReminder(item, body, context);
	if (item.every) return finishTrackerOccurrence(item, body, context);
	if (body.failed) throw trackerItemError('--failed is only for recurring items');
	guardOpenDecision(item, body);
	const decision = body.next_step === undefined ? {} : trackerNextStepFields(body.next_step);
	return { fields: { status: 'done', ...decision }, appendNote: body.note };
}

/** A finished item must not bury a question Daniel has not answered; pings and an explicit next step for Daniel do not count. */
function guardOpenDecision(item: TrackerItemSnapshot, body: TrackerItemInput): void {
	const ask = trackerOpenDecision(item);
	const handsOff = body.next_step !== undefined || Boolean(item.next_step);
	if (!ask || handsOff || body.force || isTrackerPing(ask.question)) return;
	throw trackerItemError(
		'item has an unanswered flag for Daniel: answer, resolve or unflag it first (or pass --force to finish it and keep the flag in the digest)',
		409
	);
}

function ignoreItem(
	item: TrackerItemSnapshot,
	body: TrackerItemInput,
	context: TrackerItemMutationContext
): TrackerItemChange {
	const reason = String(trackerItemValueOr(body.reason, '')).trim();
	if (!reason) throw trackerItemError('ignore needs --reason "<why>"');
	if (item.status === 'ignored') {
		throw trackerItemError(`item ${item.id.slice(0, 6)} is already ignored`, 409);
	}
	const by = trackerItemValueOr(body.by, 'unknown');
	const until = body.until ? `; until ${normalizeTrackerDue(body.until, context)}` : '';
	return {
		fields: {
			status: 'ignored',
			ignored_reason: reason,
			ignored_by: by,
			ignored_at: trackerIsoTime(context.now),
			ignored_until: trackerItemValueOr(body.until, null),
			ignored_prev_status: trackerItemValueOr(item.status, 'open')
		},
		appendNote: `ignored by ${by}: ${reason}${until}`
	};
}

function unignoreItem(item: TrackerItemSnapshot, body: TrackerItemInput): TrackerItemChange {
	if (item.status !== 'ignored') {
		throw trackerItemError(
			`item ${item.id.slice(0, 6)} is not ignored (status ${item.status})`,
			409
		);
	}
	const previous = item.ignored_prev_status;
	const status = previous && previous !== 'ignored' ? previous : 'open';
	const note = body.note ? `: ${body.note}` : '';
	return {
		fields: {
			status,
			ignored_until: null
		},
		appendNote: `unignored by ${trackerItemValueOr(body.by, 'unknown')}${note}; back to ${status}`
	};
}
