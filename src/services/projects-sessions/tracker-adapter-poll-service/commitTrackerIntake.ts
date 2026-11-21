// @harness-uid u_wlip653voz
import { randomBytes } from 'node:crypto';
import type {
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
	const manual = repository
		.candidates()
		.find((item) => matchesGithubIssue(source, record, item, policy?.matchesItem));
	return {
		action: manual ? 'link' : 'create',
		external_id: record.externalId,
		title: record.title,
		url: record.url,
		auto_launch: !manual && record.autoLaunch,
		...(manual && { item_id: manual.id })
	};
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
		sync_pending: Number(record.syncBack)
	};
	const fields = owned
		? newItemFields(source, record, context, now)
		: { 'note+': `Linked external item: ${record.url}` };
	context.store.appendLocal({ itemId, fields, actor: source.id }, () =>
		context.repository.saveLink(link)
	);
	return link;
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
	const instructions = context.policy?.instructions;
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

function trackerItemId(): string {
	const alphabet = '0123456789abcdefghjkmnpqrstvwxyz';
	return Array.from(randomBytes(10), (byte) => alphabet[byte & 31]).join('');
}
