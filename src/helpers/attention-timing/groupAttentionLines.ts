// @harness-uid u_whz5wfqkgj
import type { AttentionBatch, AttentionLine } from './attentionTiming.types';

const SEND_ORDER = ['needs_daniel', 'launch_wait', 'blocked', 'done'];

/**
 * @pure Group queued attention lines into one batch: the newest line per item and kind, ordered by kind
 * (needs-Daniel first, then launch waits, blocked, done) and then by time, with a count per kind.
 */
export function groupAttentionLines<T extends AttentionLine>(
	lines: readonly T[]
): AttentionBatch<T> {
	const newest = new Map<string, T>();
	for (const line of lines) {
		const key = `${line.itemId}\u0000${line.kind}`;
		const previous = newest.get(key);
		if (!previous || line.atMs >= previous.atMs) newest.set(key, line);
	}
	const sorted = [...newest.values()].sort(
		(a, b) => rank(a.kind) - rank(b.kind) || a.atMs - b.atMs
	);
	const counts: Record<string, number> = { needs_daniel: 0, blocked: 0, done: 0 };
	for (const line of sorted) counts[line.kind] = (counts[line.kind] ?? 0) + 1;
	return { lines: sorted, counts };
}

/** @pure Position of a kind in the send order; unknown kinds go last. */
function rank(kind: string): number {
	const index = SEND_ORDER.indexOf(kind);
	return index === -1 ? SEND_ORDER.length : index;
}
