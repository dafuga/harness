// @harness-uid u_wlip653voz
import { randomBytes } from 'node:crypto';
import type {
	TrackerAdapterCandidate,
	TrackerAdapterItem,
	TrackerAdapterLink,
	TrackerAdapterSource
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
	const { repository, policy } = context;
	const coveredId = record.followUp?.coveredItem;
	const issueItem = repository.linkByKey(source.id, record.key)?.item_id;
	const manual = coveredId
		? repository.candidates().find((item) => item.id === coveredId)
		: repository.candidates().find(
				(item) =>
					matchesGithubIssue(source, record, item, policy?.matchesItem) &&
					matchesTrackerIntakeScope(item, record, {
						issueItem,
						followUps: Boolean(policy?.followUp)
					})
			);
	const missingAction = coveredId ? 'covered' : 'create';
	const action = manual ? 'link' : missingAction;
	const itemId = manual?.id ?? coveredId;
	return {
		action,
		external_id: record.externalId,
		title: record.title,
		url: record.url,
		auto_launch: action === 'create' && record.autoLaunch,
		...(itemId && { item_id: itemId })
	};
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
	source: TrackerAdapterSource,
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
		sync_pending: Number(owned && record.syncBack)
	};
	const fields = owned
		? newItemFields(source, record, context, now)
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
	source: TrackerAdapterSource,
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

export function recordIssueAcceptance(
	context: TrackerAdapterIntakeContext,
	source: TrackerAdapterSource,
	record: TrackerAdapterIntakeRecord
): void {
	const instructions = record.followUp?.instructions;
	if (!instructions) return;
	const original = context.repository.linkByKey(source.id, record.key);
	for (const item of context.repository.candidates()) {
		if (item.adapter_instructions?.includes(instructions)) continue;
		if (!isIssueWork(item, context, source, { record, issueItem: original?.item_id })) continue;
		context.store.appendLocal({
			itemId: item.id,
			actor: source.id,
			fields: {
				adapter_instructions: [item.adapter_instructions, instructions]
					.filter(Boolean)
					.join('\n\n'),
				adapter_notice: record.externalId,
				'note+': `${instructions}\nTester follow-up: ${record.url}`
			}
		});
	}
}

function isIssueWork(
	item: TrackerAdapterCandidate,
	{ policy }: TrackerAdapterIntakeContext,
	source: TrackerAdapterSource,
	{ record, issueItem }: { record: TrackerAdapterIntakeRecord; issueItem?: string }
): boolean {
	if (item.id === issueItem || item.id === record.followUp?.coveredItem) return true;
	return (
		item.kind === 'task' &&
		matchesGithubIssue(source, record, item, policy?.matchesItem) &&
		[...item.title.matchAll(/#(\d+)/g)].every(([, key]) => key === record.key)
	);
}
