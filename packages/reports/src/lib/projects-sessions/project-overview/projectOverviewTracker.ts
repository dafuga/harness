// @harness-uid u_nves237tvx
import { readHomeAskConfirm, readHomeAskOptions } from '../hub-home/homeAskOptions';
import type { HomeAskInput } from '../hub-home/hubHome.types';
import type { MachineStatus } from './projectOverview.types';
import type {
	TrackerItemRecord,
	TrackerItemStatus,
	TrackerNote,
	TrackerRunRecord,
	TrackerSources
} from './projectOverviewTracker.types';

const TRACKER_ORIGIN = 'http://127.0.0.1:7701';
const TRACKER_TIMEOUT_MS = 1500;

/** The only tracker reads the overview may issue. Each is a fixed GET path on the local API. */
const TRACKER_GET_URLS = {
	items: `${TRACKER_ORIGIN}/items?status=all&limit=-1`,
	runs: `${TRACKER_ORIGIN}/runs?limit=500`,
	machines: `${TRACKER_ORIGIN}/machines`,
	status: `${TRACKER_ORIGIN}/status`
} as const;

const ITEM_STATUSES: ReadonlySet<string> = new Set([
	'open',
	'in_progress',
	'blocked',
	'done',
	'ignored'
]);
const MACHINE_STATUSES: ReadonlySet<string> = new Set(['ok', 'busy', 'overloaded', 'offline']);

/** Read and validate items, runs and machines. The native tracker exposes machines in /status. */
export async function readTrackerSources(
	fetcher: typeof fetch,
	includeHomeFields = false
): Promise<TrackerSources> {
	const [items, runs, machines] = await Promise.all([
		getTrackerJson(fetcher, TRACKER_GET_URLS.items),
		getTrackerJson(fetcher, TRACKER_GET_URLS.runs),
		getTrackerJson(fetcher, TRACKER_GET_URLS.machines)
	]);
	return {
		items: asList(items, 'items').map((item) => parseItem(item, includeHomeFields)),
		runs: asList(runs, 'runs').map(parseRun),
		machines: asList(machines, 'machines').map(parseMachine)
	};
}

/** Fixed loopback GETs with one deadline, no redirects and no credentials. */
async function getTrackerJson(fetcher: typeof fetch, url: string): Promise<unknown> {
	const controller = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const expired = new Promise<never>((_resolve, reject) => {
		timer = setTimeout(() => {
			controller.abort();
			reject(new Error('tracker read timed out'));
		}, TRACKER_TIMEOUT_MS);
	});
	try {
		const read = (target: string) =>
			Promise.race([
				fetcher(target, {
					method: 'GET',
					redirect: 'error',
					cache: 'no-store',
					credentials: 'omit',
					headers: { accept: 'application/json' },
					signal: controller.signal
				}),
				expired
			]);
		const response = await read(url);
		if (url === TRACKER_GET_URLS.machines && response.status === 404) {
			await closeBody(response);
			const status = await readTrackerResponse(await read(TRACKER_GET_URLS.status), expired);
			return asRecord(status, 'status').machines;
		}
		return await readTrackerResponse(response, expired);
	} finally {
		clearTimeout(timer);
	}
}

async function readTrackerResponse(response: Response, expired: Promise<never>): Promise<unknown> {
	if (!response.ok) {
		await closeBody(response);
		throw new Error('tracker read failed');
	}
	return Promise.race([response.json(), expired]);
}

async function closeBody(response: Response): Promise<void> {
	try {
		await response.body?.cancel();
	} catch {
		// The body was already closed or locked; nothing else to release.
	}
}

function parseItem(value: unknown, includeHomeFields: boolean): TrackerItemRecord {
	const row = asRecord(value, 'item');
	return {
		id: requiredText(row.id, 'item id'),
		title: requiredText(row.title, 'item title'),
		status: oneOf(row.status, ITEM_STATUSES, 'item status') as TrackerItemStatus,
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

function askFields(row: Record<string, unknown>): Partial<TrackerItemRecord> {
	const options = readHomeAskOptions(row.options as HomeAskInput);
	const confirm = readHomeAskConfirm(row.confirm as HomeAskInput);
	const askedAt = optionalTime(row.asked_at, 'item asked_at');
	return {
		...(options.length && { options }),
		...(options.length && confirm && { confirm }),
		...(askedAt && { askedAt })
	};
}

function homeFields(row: Record<string, unknown>): Partial<TrackerItemRecord> {
	return {
		kind: optionalText(row.kind, 'item kind'),
		parent: optionalText(row.parent, 'item parent'),
		computer: optionalText(row.computer, 'item computer'),
		model: optionalText(row.model, 'item model'),
		occurrence: optionalTime(row.occurrence, 'item occurrence'),
		recurring: row.recurring === true || Boolean(row.every),
		scheduleOff: row.schedule_off === true || row.schedule_off === 1,
		answer: typeof row.answer === 'string' ? row.answer : null,
		answeredAt: optionalTime(row.answered_at, 'item answered_at')
	};
}

function parseRun(value: unknown): TrackerRunRecord {
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
		ended_at: ended
	};
}

function parseMachine(value: unknown): { node: string; status: MachineStatus } {
	const row = asRecord(value, 'machine');
	return {
		node: requiredText(row.node, 'machine node'),
		status: oneOf(row.status, MACHINE_STATUSES, 'machine status') as MachineStatus
	};
}

function optionalNotes(value: unknown): TrackerNote[] | undefined {
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
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new Error(`malformed tracker ${name}`);
	}
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
