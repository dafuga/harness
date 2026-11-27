// @harness-uid u_gvp72ccrq5
import { trackerAttachmentDocumentSchema } from '../../../../../../src/utils/projects-sessions/trackerAttachmentDocumentBytes';
import type {
	PhoneTrackerResult,
	PhoneTrackerTool,
	PhoneTrackerTools
} from '../../../models/development-tooling/PhoneTracker.types';
import type {
	ConfirmedWrite,
	InboxOverview,
	InboxReply,
	InboxRow,
	TrackerInboxSource
} from '../../../models/development-tooling/TrackerInbox.types';
import { reminderHeaders } from './trackerReminders';
import { itemBucket } from './trackerInbox';
import { parseDetail, parseHeaders, parseWrites } from './phoneTrackerInboxParse';

/** The phone replica returns at most this many Needs you items per status read. */
const NEEDS_YOU_CAP = 25;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function candidatesOf(data: unknown): string[] | undefined {
	if (!isRecord(data) || !Array.isArray(data.candidates)) return undefined;
	return data.candidates.filter((id): id is string => typeof id === 'string');
}

/** Each Needs you entry also carries its question and when it was asked. */
function askOf(entries: unknown, id: string): Pick<InboxRow, 'ask'> {
	const entry = Array.isArray(entries)
		? entries.find((value) => isRecord(value) && value.id === id)
		: undefined;
	if (!isRecord(entry) || typeof entry.question !== 'string') return {};
	const since = typeof entry.askedAt === 'string' ? entry.askedAt : null;
	return { ask: { question: entry.question, since } };
}

/** `tracker_status` lists the open-flag items and the 10 most recent items. Both are headers. */
function overviewOf(data: unknown): InboxOverview | undefined {
	if (!isRecord(data)) return undefined;
	const needing = parseHeaders(data.needsYou);
	const seen = new Set(needing.map((header) => header.id));
	const recent = parseHeaders(data.recent).filter((header) => !seen.has(header.id));
	const rows: InboxRow[] = [
		...needing.map((header) => ({
			header,
			bucket: 'needs-you' as const,
			...askOf(data.needsYou, header.id)
		})),
		...recent.map((header) => ({ header, bucket: itemBucket(header.status, false) }))
	];
	const unresolved = typeof data.unresolvedFlags === 'number' ? data.unresolvedFlags : 0;
	return {
		rows,
		reminders: reminderHeaders(parseHeaders(data.reminders)),
		unresolvedFlags: unresolved,
		needsYouCapped: needing.length >= NEEDS_YOU_CAP
	};
}

function documentOf(data: unknown) {
	const parsed = trackerAttachmentDocumentSchema.safeParse(isRecord(data) ? data.document : null);
	return parsed.success ? parsed.data : undefined;
}

function writeInput(write: ConfirmedWrite): Record<string, unknown> {
	if (write.action === 'done') return { id: write.id, text: '' };
	if (write.action === 'remind') return { id: write.id, text: write.text };
	if (write.action === 'note') return { id: write.id, text: write.text };
	const reviewed = { id: write.id, text: write.text, revision: write.revision };
	return write.option === undefined ? reviewed : { ...reviewed, option: write.option };
}

/** A reminder that moved since the list was read is not written. */
async function sendReminder(
	draft: ConfirmedWrite,
	detail: TrackerInboxSource['detail'],
	send: TrackerInboxSource['write']
): ReturnType<TrackerInboxSource['write']> {
	const { value, ...read } = await detail(draft.id);
	if (value?.header.reminder?.at === draft.armed) return send(draft);
	return { ...read, code: read.code ?? 'staleReview' };
}

/** Adapts the phone's Tracker tools to the inbox page. Writes reach the outbox only when called. */
export function phoneTrackerInboxSource(tools: PhoneTrackerTools): TrackerInboxSource {
	const ask = async <T>(
		name: PhoneTrackerTool,
		input: Record<string, unknown>,
		read: (data: unknown) => T | undefined
	): Promise<InboxReply<T>> => {
		let result: PhoneTrackerResult;
		try {
			result = await tools.call(name, input);
		} catch {
			return { code: 'unavailable', freshness: 'unavailable', lastSyncedAt: null, partial: true };
		}
		const base = {
			freshness: result.freshness,
			lastSyncedAt: result.lastSyncedAt,
			partial: result.partial
		};
		if (result.code) return { ...base, code: result.code, candidates: candidatesOf(result.data) };
		const value = read(result.data);
		return value === undefined ? { ...base, code: 'invalidReply' } : { ...base, value };
	};
	const send = (write: ConfirmedWrite) =>
		ask(`tracker_${write.action}` as PhoneTrackerTool, writeInput(write), (data) =>
			isRecord(data) && typeof data.intentId === 'string' && typeof data.status === 'string'
				? { intentId: data.intentId, status: data.status }
				: undefined
		);
	const detail = (id: string) =>
		ask('tracker_show', { id }, (data) => parseDetail(data) ?? undefined);
	return {
		document: (itemId, attachment) =>
			ask('tracker_document', { id: itemId, attachment }, documentOf),
		overview: () => ask('tracker_status', {}, overviewOf),
		search: (query) =>
			ask('tracker_search', { query, limit: NEEDS_YOU_CAP }, (data) =>
				isRecord(data)
					? parseHeaders(data.items).map((header) => ({
							header,
							bucket: itemBucket(header.status, false)
						}))
					: undefined
			),
		detail,
		write: (draft) => (draft.armed === undefined ? send(draft) : sendReminder(draft, detail, send)),
		writes: () =>
			ask('tracker_write_status', {}, (data) => (isRecord(data) ? parseWrites(data) : undefined)),
		discard: (intentId) => ask('tracker_discard_write', { intentId }, (data) => data ?? {})
	};
}
