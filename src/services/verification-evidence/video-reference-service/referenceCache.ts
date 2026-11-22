// @harness-uid u_alfe4qnget
import { createHash } from 'node:crypto';
import type { PinnedHistory } from '../history-status-service/HistoryStatusService.types';
import type {
	MetadataMemo,
	VideoReferenceMemo,
	VideoReferenceCandidate,
	VideoOriginProof
} from '../VideoReferenceService.types';

export const metadataLimit = 8 * 1024 * 1024;

export function createReferenceCache(): VideoReferenceMemo {
	const empty = <T>(): MetadataMemo<T> => ({ values: new Map(), pending: new Map(), bytes: 0 });
	return { origins: empty<VideoOriginProof>(), catalogs: empty<VideoReferenceCandidate[]>() };
}

export function scopeKey(pinned: PinnedHistory): string {
	return `${pinned.evidence}:${pinned.notes}`;
}

export function originKey(
	pinned: PinnedHistory,
	trail: string[],
	record: string,
	revision: string
): string {
	return createHash('sha256')
		.update(JSON.stringify([scopeKey(pinned), trail, record, revision]))
		.digest('hex');
}

export function memoOrigin(
	memo: VideoReferenceMemo,
	key: string,
	load: () => Promise<VideoOriginProof>
): Promise<VideoOriginProof> {
	return memoized(memo.origins, key, load);
}

export function memoCatalog(
	memo: VideoReferenceMemo,
	key: string,
	load: () => Promise<VideoReferenceCandidate[]>
): Promise<VideoReferenceCandidate[]> {
	return memoized(memo.catalogs, key, load);
}

/** Pending calls coalesce; rejected work and oversized metadata are never retained. */
async function memoized<T>(memo: MetadataMemo<T>, key: string, load: () => Promise<T>): Promise<T> {
	const found = memo.values.get(key);
	if (found) {
		memo.values.delete(key);
		memo.values.set(key, found);
		return found.value;
	}
	const pending = memo.pending.get(key);
	if (pending) return pending;
	const work = load();
	if (memo.pending.size < 64) memo.pending.set(key, work);
	try {
		const value = await work,
			bytes = Buffer.byteLength(JSON.stringify(value));
		if (bytes <= metadataLimit) {
			const previous = memo.values.get(key);
			if (previous) memo.bytes -= previous.bytes;
			memo.values.set(key, { value, bytes });
			memo.bytes += bytes;
			while (memo.bytes > metadataLimit || memo.values.size > 64) {
				const first = memo.values.entries().next().value!;
				memo.values.delete(first[0]);
				memo.bytes -= first[1].bytes;
			}
		}
		return value;
	} finally {
		if (memo.pending.get(key) === work) memo.pending.delete(key);
	}
}
