// @harness-uid u_wlip653voz
import { randomBytes } from 'node:crypto';
import type {
	TrackerAdapterCandidate,
	TrackerAdapterItem,
	TrackerAdapterLink,
	TrackerAdapterSource,
	TrackerAdapterWorkSource
} from '../../../repositories/projects-sessions/TrackerAdapterRepository.types';
import type {
	TrackerAdapterAction,
	TrackerAdapterEvent,
	TrackerAdapterIntakeContext,
	TrackerAdapterIntakeRecord
} from '../TrackerAdapterPollService.types';
import { matchesGithubIssue } from './githubIntakeRecord';

export function planTrackerIntake(
	context: TrackerAdapterIntakeContext,
	source: TrackerAdapterSource,
	record: TrackerAdapterIntakeRecord
): TrackerAdapterAction {
	const coveredId = record.followUp?.coveredItem;
	const manual = existingIntakeItem(context, source, record);
	const action = manual ? 'link' : missingIntakeAction(coveredId);
	return intakeAction(context, record, action, manual?.id ?? coveredId);
}

function missingIntakeAction(coveredId?: string) {
	return coveredId ? 'covered' : 'create';
}

function intakeAction(
	context: TrackerAdapterIntakeContext,
	record: TrackerAdapterIntakeRecord,
	action: TrackerAdapterAction['action'],
	itemId?: string
): TrackerAdapterAction {
	return {
		action,
		external_id: record.externalId,
		title: record.title,
		url: record.url,
		auto_launch: action === 'create' && record.autoLaunch,
		...(itemId && { item_id: itemId }),
		...assignedPriority(context, record, action)
	};
}

function assignedPriority(
	context: TrackerAdapterIntakeContext,
	record: TrackerAdapterIntakeRecord,
	action: TrackerAdapterAction['action']
) {
	if (action !== 'create') return {};
	const priority = context.policy?.priority?.(record, {
		actor: record.actor,
		kind: record.followUp ? 'comment' : 'issue'
	});
	return priority && priority !== 'normal' ? { priority } : {};
}

function existingIntakeItem(
	{ repository, policy }: TrackerAdapterIntakeContext,
	source: TrackerAdapterSource,
	record: TrackerAdapterIntakeRecord
) {
	const coveredId = record.followUp?.coveredItem;
	const issueItem = repository.linkByKey(source.id, record.key)?.item_id;
	return coveredId
		? repository.candidates().find((item) => item.id === coveredId)
		: repository.candidates().find(
				(item) =>
					matchesGithubIssue(source, record, item, policy?.matchesItem) &&
					matchesTrackerIntakeScope(item, record, {
						issueItem,
						followUps: Boolean(policy?.followUp)
					})
			);
}

function matchesTrackerIntakeScope(
	item: TrackerAdapterCandidate,
	record: TrackerAdapterIntakeRecord,
	{ issueItem, followUps }: { issueItem?: string; followUps: boolean }
): boolean {
	if (!record.followUp) return !followUps || !/\(GitHub comment \d+\)$/.test(item.title);
	if (item.id === issueItem || item.kind !== 'task') return false;
	const suffix = record.externalId.slice(8);
	const commentLinks = item.notes?.match(/https:\/\/github\.com\/[^\s#]+#issuecomment-\d+/gi);
	return (
		item.title.endsWith(`(GitHub comment ${suffix})`) ||
		Boolean(commentLinks?.some((url) => url.toLowerCase() === record.url.toLowerCase()))
	);
}

export function commitTrackerIntake(
	context: TrackerAdapterIntakeContext,
	source: TrackerAdapterWorkSource,
	record: TrackerAdapterIntakeRecord,
	action: TrackerAdapterAction
): TrackerAdapterLink {
	const owned = action.action === 'create';
	const itemId = action.item_id ?? (context.dependencies.itemId ?? trackerItemId)();
	const now = (context.dependencies.now ?? Date.now)();
	const link = {
		source_id: source.id,
		external_id: record.externalId,
		external_key: record.key,
		item_id: itemId,
		remote_state: owned ? record.state : null,
		events_after: record.historical ? now : source.enabled_at,
		owned: Number(owned),
		sync_pending: Number(record.syncBack && (owned || !record.followUp))
	};
	const fields = owned
		? { ...newItemFields(source, record, context, now), priority: action.priority ?? 'normal' }
		: linkedItemFields(context, record, itemId);
	context.store.appendLocal({ itemId, fields, actor: source.id }, () =>
		context.repository.saveLink(link)
	);
	return link;
}

function linkedItemFields(
	{ repository }: TrackerAdapterIntakeContext,
	record: TrackerAdapterIntakeRecord,
	itemId: string
): Record<string, unknown> {
	const fields: Record<string, unknown> = { 'note+': `Linked external item: ${record.url}` };
	const instructions = record.acceptanceInstructions;
	if (!instructions) return fields;
	const current = repository.candidates().find(({ id }) => id === itemId)?.adapter_instructions;
	if (!current?.includes(instructions))
		fields.adapter_instructions = [current, instructions].filter(Boolean).join('\n\n');
	return fields;
}

export function trackerEventFields(
	item: TrackerAdapterItem,
	link: TrackerAdapterLink,
	event: Omit<TrackerAdapterEvent, 'id' | 'time'> & { id?: string }
): Record<string, unknown> {
	const fields: Record<string, unknown> = { 'note+': event.note };
	if (event.nudge) fields.adapter_notice = event.id;
	if (!event.state || item.status === 'ignored') return fields;
	const closed = event.state === 'closed';
	const status = closed ? 'done' : 'open';
	if (item.status !== status) {
		fields.status = status;
		fields.adapter_closed = Number(closed);
	}
	if (link.owned && closed) {
		fields.due = null;
		fields.schedule_off = 1;
		if (item.launch_source === 'due') fields.auto = null;
	}
	return fields;
}

function newItemFields(
	source: TrackerAdapterWorkSource,
	record: TrackerAdapterIntakeRecord,
	context: TrackerAdapterIntakeContext,
	now: number
): Record<string, unknown> {
	const time = new Date(now).toISOString();
	const dueOwner = record.autoLaunch ? context.dependencies.dueOwner?.(source) : undefined;
	const instructions = trackerInstructions(record, context.policy?.instructions);
	return {
		kind: source.kind,
		status: record.state === 'closed' ? 'done' : 'open',
		needs_daniel: 0,
		resolved: 0,
		deleted: 0,
		created_at: time,
		created_by: context.store.node,
		agent: source.agent,
		project: source.project,
		owner: source.owner,
		model: source.model,
		computer: dueOwner ?? source.computer,
		...(source.every && { every: source.every, every_tz: source.every_tz }),
		title: record.title,
		notes: record.notes,
		...(instructions && { adapter_instructions: instructions }),
		...(record.autoLaunch ? { due: time } : { schedule_off: 1 }),
		...(dueOwner && { adapter_due_owner: dueOwner })
	};
}

function trackerInstructions(record: TrackerAdapterIntakeRecord, base?: string): string {
	return [base, record.followUp?.instructions ?? record.acceptanceInstructions]
		.filter(Boolean)
		.join('\n\n');
}

function trackerItemId(): string {
	const alphabet = '0123456789abcdefghjkmnpqrstvwxyz';
	return Array.from(randomBytes(10), (byte) => alphabet[byte & 31]).join('');
}
