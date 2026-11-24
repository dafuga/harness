// @harness-uid u_k4rxbz6pq3
import type { OverviewDeps } from './trackerOverviewPolicy.types';
import type { OverviewPayload, ReadyOverviewPayload } from './trackerOverviewInput.types';
import { readySnapshot } from './trackerOverviewInput';
import type {
	OverviewBucket,
	OverviewProvenance,
	StoredOverview
} from './trackerOverviewCache.types';

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
	provenance: OverviewProvenance
): Promise<void> {
	const stored: StoredOverview = { ...provenance, snapshot };
	await bucket.put(key, JSON.stringify(stored), {
		httpMetadata: { contentType: 'application/json' }
	});
}

/** Removes the stored snapshot, so an unavailable publish leaves nothing to show. */
export async function clearOverview(bucket: OverviewBucket, key: string): Promise<void> {
	await bucket.delete(key);
}

/** The latest snapshot is readable only while its publishing authority still exists. */
export async function readOverview(
	bucket: OverviewBucket,
	key: string,
	deps: Pick<OverviewDeps, 'now' | 'ownerId' | 'sessions'>
): Promise<OverviewPayload> {
	const unavailable = { status: 'unavailable' } as const;
	const object = await bucket.get(key);
	if (!object) return unavailable;
	try {
		const stored = JSON.parse(await object.text()) as StoredOverview;
		const age = deps.now - stored.receivedAt;
		if (!Number.isSafeInteger(stored.receivedAt) || age < 0) return unavailable;
		if (age > OVERVIEW_TTL_MS) return { ...unavailable, reason: 'stale' };
		if (typeof stored.publisher !== 'string' || !deps.ownerId) return unavailable;
		const snapshot = readySnapshot(stored.snapshot);
		if (!(await deps.sessions?.publisherLive(stored.publisher, deps.ownerId)))
			return { ...unavailable, reason: 'host-revoked' };
		return snapshot;
	} catch {
		return unavailable;
	}
}
