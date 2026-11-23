// @harness-uid u_st4dufvqxm
import type { PhoneReplicaSnapshot } from './phoneReplicaPages.types';
import type { FeedRow } from './PhoneReplicaFeed.types';
import type { PhoneTrackerRow } from './phoneReplicaRows.types';

export const expiredSnapshot = { kind: 'reset', reason: 'snapshot' } as const;
export const invalidCursor = { kind: 'reset', reason: 'cursor' } as const;

export function snapshotPage(snapshot: PhoneReplicaSnapshot, offset: number) {
	const { rows, id, cursor, startedAt } = snapshot;
	const page = boundedPage(rows, offset);
	const end = offset + page.length;
	return {
		kind: 'snapshot',
		snapshotId: id,
		requestContinuation: offset === 0 ? null : `${id}:${offset}`,
		rows: page.map(({ json }) => JSON.parse(json) as PhoneTrackerRow),
		cursor: end < rows.length ? null : cursor,
		continuation: end < rows.length ? `${id}:${end}` : null,
		hubTime: new Date(startedAt).toISOString(),
		partial: true
	};
}

export function deltaPage(
	rows: FeedRow[],
	input: { cursor: string; sequence: string; now: number }
) {
	const page = boundedPage(rows, 0);
	return {
		sequence: page.at(-1)?.seq ?? input.sequence,
		reply: {
			kind: 'delta',
			requestCursor: input.cursor,
			hasMore: page.length < rows.length,
			operations: page.map(({ id, json }) => ({
				id,
				row: json === null ? null : (JSON.parse(json) as PhoneTrackerRow)
			})),
			hubTime: new Date(input.now).toISOString(),
			partial: true
		}
	};
}

function boundedPage<T extends { id: string; json: string | null }>(
	rows: T[],
	offset: number
): T[] {
	const page: T[] = [];
	let bytes = 2048;
	for (const row of rows.slice(offset, offset + 100)) {
		bytes += Buffer.byteLength(row.json ?? '') + Buffer.byteLength(JSON.stringify(row.id)) + 32;
		if (bytes > 128 * 1024) break;
		page.push(row);
	}
	return page;
}
