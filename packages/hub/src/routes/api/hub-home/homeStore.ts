import type { OwnerHomeSnapshot } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import {
	overviewKey,
	OVERVIEW_TTL_MS,
	readOverview
} from '../tracker-overview/trackerOverviewCache';
import type { OverviewBucket } from '../tracker-overview/trackerOverviewCache.types';
import { controlledIds, parseHomePayload } from './homePayload';

const prefix = 'hub-home/v1/';

export async function homeKey(ownerId: string) {
	const key = await overviewKey(ownerId);
	return prefix + key.split('/').at(-1);
}

export async function storeHome(
	bucket: OverviewBucket,
	ownerId: string,
	snapshot: OwnerHomeSnapshot,
	now: number
) {
	await bucket.put(await homeKey(ownerId), JSON.stringify({ snapshot, receivedAt: now }), {
		httpMetadata: { contentType: 'application/json' }
	});
}

export async function readPublishedHome(
	bucket: OverviewBucket,
	ownerId: string,
	now: number
): Promise<OwnerHomeSnapshot | null> {
	const stored = await bucket.get(await homeKey(ownerId));
	if (stored) {
		try {
			const { receivedAt, snapshot } = JSON.parse(await stored.text());
			const age = now - receivedAt;
			if (Number.isSafeInteger(receivedAt) && age >= 0 && age <= OVERVIEW_TTL_MS)
				return parseHomePayload(snapshot);
		} catch {
			// The older overview is independently verified and can still supply the work view.
		}
	}
	return null;
}

export async function readHomeSnapshot(
	bucket: OverviewBucket,
	ownerId: string,
	now: number
): Promise<OwnerHomeSnapshot | null> {
	const published = await readPublishedHome(bucket, ownerId, now);
	if (published) return published;
	const overview = await readOverview(bucket, await overviewKey(ownerId), now);
	return overview
		? {
				overview,
				agents: [],
				plans: [],
				scheduled: [],
				providers: { routines: null, quota: null }
			}
		: null;
}

/** Tracker agent values Daniel added as sessions he controls himself, beyond the built-in ones. */
const controlledPrefix = 'hub-home-agents/v1/';
const maxControlled = 20;

async function controlledKey(ownerId: string) {
	return controlledPrefix + (await homeKey(ownerId)).split('/').at(-1);
}

export async function readControlled(bucket: OverviewBucket, ownerId: string): Promise<string[]> {
	const stored = await bucket.get(await controlledKey(ownerId));
	if (!stored) return [];
	try {
		return controlledIds.parse(JSON.parse(await stored.text()));
	} catch {
		return [];
	}
}

/** Adds or removes one session id and returns the new list; an id already present stays once. */
export async function changeControlled(
	bucket: OverviewBucket,
	ownerId: string,
	change: { id: string; add: boolean }
): Promise<string[] | null> {
	const current = await readControlled(bucket, ownerId);
	const rest = current.filter((id) => id !== change.id);
	const next = change.add ? [...rest, change.id] : rest;
	if (next.length > maxControlled) return null;
	await bucket.put(await controlledKey(ownerId), JSON.stringify(next), {
		httpMetadata: { contentType: 'application/json' }
	});
	return next;
}
