// @harness-uid u_4pgfvaopdt
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
	trackerIsoTime,
	trackerLocalStamp,
	trackerTimeZone
} from './normalizeTrackerDue';
import { trackerItemError } from './trackerItemError';
import { trackerItemValueOr } from './trackerItemValueOr';
import { guardTrackerDuplicate } from './trackerItemInput';
const start = { status: 'in_progress' };
const resolved = { resolved: 1, needs_daniel: 0 };

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
	remind: (item, body, context) => {
		if (item.status === 'done' || item.status === 'ignored')
			throw trackerItemError('only active items can be reminded', 409);
		return { fields: { remind_at: normalizeTrackerReminder(body.at, context.now) } };
	},
	answer: (_, body, context) => {
		if (!body.answer) throw trackerItemError('answer text required');
		return resolveItem(body, context);
	},
	unflag: () => ({ fields: { needs_daniel: 0 } }),
	resolve: (_, body, context) => resolveItem(body, context),
	done: finishItem,
	ignore: ignoreItem,
	unignore: unignoreItem
};

function blockItem(
	item: TrackerItemSnapshot,
	body: TrackerItemInput,
	context: TrackerItemMutationContext
): TrackerItemChange {
	const reason = String(trackerItemValueOr(body.reason, '')).trim();
	if (!reason) throw trackerItemError('block reason required');
	const fields = { status: 'blocked', blocked_reason: reason };
	const appendNote = `blocked: ${reason}`;
	if (body.needs_daniel === false) return { fields, appendNote };
	guardTrackerDuplicate(context, {
		text: `${item.title} ${reason}`,
		agent: item.agent,
		excludeId: item.id,
		force: body.force,
		askingDaniel: true
	});
	return {
		fields: { ...fields, needs_daniel: 1, resolved: 0, question: `Blocked: ${reason}` },
		appendNote
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
			...(body.question ? { question: body.question } : {})
		}
	};
}

function resolveItem(
	body: TrackerItemInput,
	context: TrackerItemMutationContext
): TrackerItemChange {
	return {
		fields: {
			...resolved,
			answered_at: trackerIsoTime(context.now),
			answered_by: trackerItemValueOr(body.by, 'daniel'),
			...(body.answer ? { answer: body.answer } : {}),
			...(body.done ? { status: 'done' } : {})
		}
	};
}

function finishItem(
	item: TrackerItemSnapshot,
	body: TrackerItemInput,
	context: TrackerItemMutationContext
): TrackerItemChange {
	if (item.every) return finishOccurrence(item, body, context);
	if (body.failed) throw trackerItemError('--failed is only for recurring items');
	return { fields: { status: 'done' }, appendNote: body.note };
}

function finishOccurrence(
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
			ignored_until: null,
			...(item.needs_daniel && !item.resolved ? { needs_daniel: 1 } : {})
		},
		appendNote: `unignored by ${trackerItemValueOr(body.by, 'unknown')}${note}; back to ${status}`
	};
}
