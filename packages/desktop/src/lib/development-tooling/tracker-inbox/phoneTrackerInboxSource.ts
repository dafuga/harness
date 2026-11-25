// @harness-uid u_gvp72ccrq5
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

/** `tracker_status` lists the open-flag items and the 10 most recent items. Both are headers. */
function overviewOf(data: unknown): InboxOverview | undefined {
	if (!isRecord(data)) return undefined;
	const needing = parseHeaders(data.needsYou);
	const seen = new Set(needing.map((header) => header.id));
	const recent = parseHeaders(data.recent).filter((header) => !seen.has(header.id));
	const rows: InboxRow[] = [
		...needing.map((header) => ({ header, bucket: 'needs-you' as const })),
		...recent.map((header) => ({ header, bucket: itemBucket(header.status, false) }))
	];
	const unresolved = typeof data.unresolvedFlags === 'number' ? data.unresolvedFlags : 0;
	return { rows, unresolvedFlags: unresolved, needsYouCapped: needing.length >= NEEDS_YOU_CAP };
}

function writeInput(write: ConfirmedWrite): Record<string, unknown> {
	if (write.action === 'note') return { id: write.id, text: write.text };
	const reviewed = { id: write.id, text: write.text, revision: write.revision };
	return write.option === undefined ? reviewed : { ...reviewed, option: write.option };
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
	return {
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
		detail: (id) => ask('tracker_show', { id }, (data) => parseDetail(data) ?? undefined),
		write: (write) =>
			ask(`tracker_${write.action}` as PhoneTrackerTool, writeInput(write), (data) =>
				isRecord(data) && typeof data.intentId === 'string' && typeof data.status === 'string'
					? { intentId: data.intentId, status: data.status }
					: undefined
			),
		writes: () =>
			ask('tracker_write_status', {}, (data) => (isRecord(data) ? parseWrites(data) : undefined)),
		discard: (intentId) => ask('tracker_discard_write', { intentId }, (data) => data ?? {})
	};
}
