// @harness-uid u_4pgfvaopdt
import { checkTrackerItem } from './checkTrackerItem';
import { clearsTrackerRecurrence, requestsTrackerLaunch } from './normalizeTrackerItemFields';
import type { TrackerItemInput, TrackerItemValue } from './normalizeTrackerItemFields.types';
import type {
	TrackerDuplicateProbe,
	TrackerItemMutationContext,
	TrackerItemChange,
	TrackerItemSnapshot
} from './planTrackerItemMutation.types';
import { normalizeTrackerParkUntil, trackerIsoTime, trackerTimeZone } from './normalizeTrackerDue';
import { trackerItemLaunchFields } from './trackerItemLaunchFields';
import { trackerModelChoiceFields } from './trackerModelChoiceFields';
import { trackerItemError } from './trackerItemError';
import { trackerItemValueOr } from './trackerItemValueOr';

const apiFields = [
	'kind',
	'title',
	'status',
	'due',
	'owner',
	'agent',
	'notes',
	'parent',
	'question',
	'options',
	'confirm',
	'needs_daniel',
	'auto',
	'remind_at',
	'project',
	'repo',
	'computer',
	'model',
	'sensitive',
	'every',
	'every_tz'
];

export function trackerItemInput(
	body: TrackerItemInput,
	context: TrackerItemMutationContext,
	current?: TrackerItemSnapshot
): TrackerItemInput {
	const fields: Record<string, TrackerItemValue> = {};
	for (const key of apiFields) {
		if (body[key] !== undefined) fields[key] = body[key];
	}
	applyRecurrenceFields(fields, current);
	validateNamedModel(fields, context, current);
	Object.assign(fields, trackerModelChoiceFields(fields, body));
	applyAliases(fields, body, context.node);
	if (body.next_step !== undefined) Object.assign(fields, trackerNextStepFields(body.next_step));
	if (!current && body.later === true) {
		if (requestsTrackerLaunch(fields.auto)) throw trackerItemError('--later conflicts with --auto');
		fields.schedule_off = 1;
		fields.schedule_hold_reason = 'Task added with --later';
	}
	checkItemInput(fields, context, body.force, current);
	return trackerItemLaunchFields(fields, context, current);
}

function checkItemInput(
	fields: TrackerItemInput,
	context: TrackerItemMutationContext,
	force: unknown,
	current?: TrackerItemSnapshot
): void {
	if (!requiresDuplicateCheck(fields, current)) return;
	const title = trackerItemValueOr(fields.title, current?.title) ?? '';
	const question = trackerItemValueOr(fields.question, current?.question) ?? '';
	guardTrackerDuplicate(context, {
		text: `${title} ${question}`,
		agent: trackerItemValueOr(fields.agent, current?.agent),
		excludeId: current?.id,
		force,
		askingDaniel: Boolean(current)
	});
}

function requiresDuplicateCheck(fields: TrackerItemInput, current?: TrackerItemSnapshot): boolean {
	if (!current) return true;
	return Boolean(fields.needs_daniel) && !(current.needs_daniel && !current.resolved);
}

function applyRecurrenceFields(
	fields: Record<string, TrackerItemValue>,
	current?: TrackerItemSnapshot
): void {
	const { every, kind, every_tz: timeZone } = fields;
	if (every === undefined) {
		requireRecurringSchedule(kind, current?.every);
		return;
	}
	if (clearsTrackerRecurrence(every)) {
		clearRecurrence(fields, current);
		return;
	}
	if (kind === undefined && allowsRecurringKind(current)) fields.kind = 'recurring';
	if (timeZone === undefined && !current?.every_tz) fields.every_tz = trackerTimeZone;
}

function requireRecurringSchedule(kind: unknown, schedule: string | null | undefined): void {
	if (kind === 'recurring' && !schedule) {
		throw trackerItemError('recurring items need --every "<cron>"');
	}
}

function clearRecurrence(
	fields: Record<string, TrackerItemValue>,
	current?: TrackerItemSnapshot
): void {
	Object.assign(fields, { every: null, occurrence: null, missed: null });
	if (fields.kind === undefined && current?.kind === 'recurring') fields.kind = 'task';
}

function allowsRecurringKind(current?: TrackerItemSnapshot): boolean {
	return !current || current.kind === 'task' || current.kind === 'recurring';
}

function validateNamedModel(
	fields: TrackerItemInput,
	context: TrackerItemMutationContext,
	current?: TrackerItemSnapshot
): void {
	if (!fields.model) return;
	if (!context.validateModel)
		throw new TypeError('Tracker named models require a model-policy collaborator');
	const project = fields.project ?? current?.project ?? fields.agent ?? current?.agent;
	try {
		context.validateModel(fields.model, project);
	} catch (error) {
		throw trackerItemError(error instanceof Error ? error.message : String(error));
	}
}

function applyAliases(
	fields: Record<string, TrackerItemValue>,
	body: TrackerItemInput,
	node: string
): void {
	if (body.callback !== undefined) fields.callback = body.callback;
	if (body.callback_url) fields.callback = { url: body.callback_url, node };
	if (body.callback_cmd) fields.callback = { cmd: body.callback_cmd, node };
	if (body.flag || body.question) fields.needs_daniel = 1;
	if (fields.needs_daniel) fields.resolved = 0;
}

export function trackerNextStepFields(value: TrackerItemValue): TrackerItemInput {
	if (typeof value !== 'string' || !value.trim()) throw trackerItemError('next step text required');
	const text = value.trim();
	return { next_step: text, question: text, needs_daniel: 1, resolved: 0 };
}

function requireNextStep(item: TrackerItemSnapshot): void {
	if (!item.next_step) throw trackerItemError('item has no open next step', 409);
}

export function trackerMoveOn(item: TrackerItemSnapshot): TrackerItemChange {
	requireNextStep(item);
	return {
		fields: { status: 'done', needs_daniel: 0, resolved: 1, next_step: null, parked_until: null },
		appendNote: 'Daniel moved on from this topic'
	};
}

export function trackerParkNextStep(
	item: TrackerItemSnapshot,
	body: TrackerItemInput,
	context: TrackerItemMutationContext
): TrackerItemChange {
	requireNextStep(item);
	return { fields: { parked_until: normalizeTrackerParkUntil(body.until, context.now) } };
}

export function trackerResolveItem(
	item: TrackerItemSnapshot,
	body: TrackerItemInput,
	context: TrackerItemMutationContext
): TrackerItemChange {
	return {
		fields: {
			...(item.next_step ? {} : { resolved: 1, needs_daniel: 0 }),
			answered_at: trackerIsoTime(context.now),
			answered_by: trackerItemValueOr(body.by, 'daniel'),
			...(body.answer ? { answer: body.answer } : {}),
			// Re-stamping the block after the answer records "keep waiting": nothing relaunches.
			...(body.keep_blocked && item.status === 'blocked' ? { status: 'blocked' } : {}),
			...(body.done ? { status: 'done' } : {})
		}
	};
}

export function guardTrackerDuplicate(
	context: TrackerItemMutationContext,
	probe: TrackerDuplicateProbe
): void {
	if (probe.force || !probe.text.trim()) return;
	const matches = checkTrackerItem(context.candidates, probe.text, probe);
	const ignored = matches.ignored[0];
	if (ignored) {
		throw trackerItemError(
			`already reported and ignored: [${ignored.id.slice(0, 6)}] ${ignored.title} (${trackerItemValueOr(ignored.ignored_reason, 'no reason given')})`,
			409,
			{ code: 'ignored_duplicate', matches: matches.ignored }
		);
	}
	const open = probe.askingDaniel
		? matches.open.filter((match) => match.needs_daniel)
		: matches.open;
	const first = open[0];
	if (!first) return;
	const short = first.id.slice(0, 6);
	throw trackerItemError(
		`similar item already open: [${short}] ${first.title}; use tracker note ${short} "..." instead`,
		409,
		{ code: 'open_duplicate', matches: open }
	);
}
