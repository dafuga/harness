// @harness-uid u_nves237tvx
import type { TrackerAttachmentListingSource } from '../../../../../../src/utils/projects-sessions/trackerAttachment.types';
import { trackerAttachmentFields } from '../../../../../../src/utils/projects-sessions/trackerAttachments';
import {
	trackerPlanningSchema,
	trackerStageSchema
} from '../../../../../../src/utils/projects-sessions/trackerPlanning';
import { readHomeAskConfirm, readHomeAskOptions } from '../hub-home/homeAskOptions';
import type { HomeAskInput } from '../hub-home/hubHome.types';
import type { MachineStatus } from './projectOverview.types';
import type * as Tracker from './projectOverviewTracker.types';
import { TRACKER_GET_URLS, ITEM_STATUSES, MACHINE_STATUSES } from './trackerReadTargets';
import { trackerRunDetail } from './projectOverviewRunDetail';
import { getTrackerJson } from './trackerJsonRead';

/** Read and validate items, runs and machines. The native tracker exposes machines in /status. */
export async function readTrackerSources(
	fetcher: typeof fetch,
	includeHomeFields = false
): Promise<Tracker.TrackerSources> {
	const [items, runs, machines] = await Promise.all([
		getTrackerJson(fetcher, TRACKER_GET_URLS.items),
		getTrackerJson(fetcher, TRACKER_GET_URLS.runs),
		getTrackerJson(fetcher, TRACKER_GET_URLS.machines)
	]);
	return {
		items: asList(items, 'items').map((item) => parseItem(item, includeHomeFields)),
		runs: asList(runs, 'runs').map((run) => parseRun(run, includeHomeFields)),
		machines: asList(machines, 'machines').map(parseMachine)
	};
}

function parseItem(value: unknown, includeHomeFields: boolean): Tracker.TrackerItemRecord {
	const row = asRecord(value, 'item');
	return {
		id: requiredText(row.id, 'item id'),
		title: requiredText(row.title, 'item title'),
		status: oneOf(row.status, ITEM_STATUSES, 'item status') as Tracker.TrackerItemRecord['status'],
		updated_at: requiredTime(row.updated_at, 'item updated_at'),
		due: optionalTime(row.due, 'item due'),
		agent: optionalText(row.agent, 'item agent'),
		sensitive: optionalBoolean(row.sensitive, 'item sensitive'),
		deleted: optionalBoolean(row.deleted, 'item deleted'),
		blocked_reason: optionalText(row.blocked_reason, 'item blocked_reason'),
		needs_daniel: optionalBoolean(row.needs_daniel, 'item needs_daniel'),
		resolved: optionalBoolean(row.resolved, 'item resolved'),
		question: optionalText(row.question, 'item question'),
		notes_log: optionalNotes(row.notes_log),
		...askFields(row),
		...(includeHomeFields ? homeFields(row) : {})
	};
}

function askFields(row: Record<string, unknown>): Partial<Tracker.TrackerItemRecord> {
	const options = readHomeAskOptions(row.options as HomeAskInput);
	const confirm = readHomeAskConfirm(row.confirm as HomeAskInput);
	const askedAt = optionalTime(row.asked_at, 'item asked_at');
	return {
		...(options.length && { options }),
		...(options.length && confirm && { confirm }),
		...(askedAt && { askedAt }),
		...trackerAttachmentFields(row.attachments as TrackerAttachmentListingSource)
	};
}

function homeFields(row: Record<string, unknown>): Partial<Tracker.TrackerItemRecord> {
	return {
		project: typeof row.project === 'string' ? row.project : null,
		kind: optionalText(row.kind, 'item kind'),
		parent: optionalText(row.parent, 'item parent'),
		computer: optionalText(row.computer, 'item computer'),
		model: optionalText(row.model, 'item model'),
		occurrence: optionalTime(row.occurrence, 'item occurrence'),
		recurring: row.recurring === true || Boolean(row.every),
		remindAt: optionalTime(row.remind_at, 'item remind_at'),
		every: optionalText(row.every, 'item every'),
		scheduleOff: row.schedule_off === true || row.schedule_off === 1,
		priority: optionalText(row.priority, 'item priority'),
		owner: typeof row.owner === 'string' ? row.owner : null,
		launchRequested: Boolean(row.auto),
		launchToken: typeof row.auto === 'string' ? row.auto : null,
		answer: typeof row.answer === 'string' ? row.answer : null,
		answeredAt: optionalTime(row.answered_at, 'item answered_at'),
		stage: trackerStageSchema.safeParse(row.stage).data ?? null,
		planning: trackerPlanningSchema.safeParse(row.planning).data
	};
}

function parseRun(value: unknown, includeHomeFields: boolean): Tracker.TrackerRunRecord {
	const row = asRecord(value, 'run');
	const ended = row.ended_at ?? null;
	if (ended !== null && (typeof ended !== 'number' || !Number.isFinite(ended)))
		throw new Error('malformed run ended_at');
	if (typeof row.id !== 'number' || !Number.isInteger(row.id)) throw new Error('malformed run id');
	return {
		id: row.id,
		node: optionalText(row.node, 'run node'),
		item_id: requiredText(row.item_id, 'run item_id'),
		state: requiredText(row.state, 'run state'),
		ended_at: ended,
		...(includeHomeFields ? trackerRunDetail(row) : {})
	};
}

function parseMachine(value: unknown): Tracker.TrackerSources['machines'][number] {
	const row = asRecord(value, 'machine');
	const count = row.remote_runs;
	const whole = typeof count === 'number' && Number.isSafeInteger(count);
	return {
		...(whole && count >= 0 && count <= 1_000_000 && { remoteRuns: count }),
		node: requiredText(row.node, 'machine node'),
		status: oneOf(row.status, MACHINE_STATUSES, 'machine status') as MachineStatus
	};
}

function optionalNotes(value: unknown): Tracker.TrackerItemRecord['notes_log'] {
	if (value === undefined || value === null) return undefined;
	return asList(value, 'notes_log').map((note) => {
		const row = asRecord(note, 'note');
		return { at: requiredTime(row.at, 'note at'), text: requiredText(row.text, 'note text') };
	});
}

function asList(value: unknown, name: string): unknown[] {
	if (!Array.isArray(value)) throw new Error(`malformed tracker ${name}`);
	return value;
}

function asRecord(value: unknown, name: string): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value))
		throw new Error(`malformed tracker ${name}`);
	return value as Record<string, unknown>;
}

function requiredText(value: unknown, name: string): string {
	if (typeof value !== 'string' || value.length === 0) throw new Error(`malformed ${name}`);
	return value;
}

function optionalText(value: unknown, name: string): string | null | undefined {
	if (value === undefined || value === null) return value;
	return requiredText(value, name);
}

function optionalBoolean(value: unknown, name: string): boolean | undefined {
	if (value === undefined) return undefined;
	if (typeof value !== 'boolean') throw new Error(`malformed ${name}`);
	return value;
}

function requiredTime(value: unknown, name: string): string {
	const text = requiredText(value, name);
	if (Number.isNaN(Date.parse(text))) throw new Error(`malformed ${name}`);
	return text;
}

function optionalTime(value: unknown, name: string): string | null | undefined {
	if (value === undefined || value === null) return value;
	return requiredTime(value, name);
}

function oneOf(value: unknown, allowed: ReadonlySet<string>, name: string): string {
	const text = requiredText(value, name);
	if (!allowed.has(text)) throw new Error(`unknown ${name}`);
	return text;
}
