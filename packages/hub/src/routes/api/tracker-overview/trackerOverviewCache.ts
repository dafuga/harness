// @harness-uid u_k4rxbz6pq3
import type { ReadyOverviewPayload } from './trackerOverviewInput.types';
import { readySnapshot } from './trackerOverviewInput';
import type { OverviewBucket, StoredOverview } from './trackerOverviewCache.types';

/** A snapshot received longer ago than this is unavailable, never shown. */
export const OVERVIEW_TTL_MS = 90_000;

const NAMESPACE = 'project-overview/v1/';

/** The private object key: a digest of the owner's actor ID. A changed owner names a new, empty key. */
export async function overviewKey(ownerId: string): Promise<string> {
	const bytes = new TextEncoder().encode(ownerId);
	const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
	const hex = [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
	return `${NAMESPACE}${hex}.json`;
}

/** Stores one ready snapshot with the server's reception time. */
export async function storeOverview(
	bucket: OverviewBucket,
	key: string,
	snapshot: ReadyOverviewPayload,
	now: number
): Promise<void> {
	const stored: StoredOverview = { receivedAt: now, snapshot };
	await bucket.put(key, JSON.stringify(stored), {
		httpMetadata: { contentType: 'application/json' }
	});
}

/** Removes the stored snapshot, so an unavailable publish leaves nothing to show. */
export async function clearOverview(bucket: OverviewBucket, key: string): Promise<void> {
	await bucket.delete(key);
}

/** The stored snapshot while it is fresh and well formed; null otherwise. */
export async function readOverview(
	bucket: OverviewBucket,
	key: string,
	now: number
): Promise<ReadyOverviewPayload | null> {
	const object = await bucket.get(key);
	if (!object) return null;
	try {
		const stored = JSON.parse(await object.text()) as StoredOverview;
		const age = now - stored.receivedAt;
		if (!Number.isSafeInteger(stored.receivedAt) || age < 0 || age > OVERVIEW_TTL_MS) return null;
		return readySnapshot(stored.snapshot);
	} catch {
		return null;
	}
}
