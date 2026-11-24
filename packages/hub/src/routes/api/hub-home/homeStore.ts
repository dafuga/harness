import type { HomeDeps } from './homePolicy.types';
import type { OwnerHomeSnapshot } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import {
	overviewKey,
	OVERVIEW_TTL_MS,
	readOverview
} from '../tracker-overview/trackerOverviewCache';
import type {
	OverviewBucket,
	OverviewProvenance
} from '../tracker-overview/trackerOverviewCache.types';
import { parseHomePayload } from './homePayload';

const prefix = 'hub-home/v1/';

export async function homeKey(ownerId: string) {
	const key = await overviewKey(ownerId);
	return prefix + key.split('/').at(-1);
}

export async function storeHome(
	bucket: OverviewBucket,
	ownerId: string,
	snapshot: OwnerHomeSnapshot,
	provenance: OverviewProvenance
) {
	await bucket.put(await homeKey(ownerId), JSON.stringify({ snapshot, ...provenance }), {
		httpMetadata: { contentType: 'application/json' }
	});
}

export async function readHomeSnapshot(
	bucket: OverviewBucket,
	ownerId: string,
	deps: Pick<HomeDeps, 'now' | 'sessions'>
): Promise<OwnerHomeSnapshot | null> {
	const home = await currentHome(bucket, ownerId, deps);
	if (home) return home;
	const overview = await readOverview(bucket, await overviewKey(ownerId), { ...deps, ownerId });
	return overview.status === 'ready' || overview.reason
		? {
				overview,
				agents: [],
				plans: [],
				scheduled: [],
				providers: { routines: null, quota: null }
			}
		: null;
}

async function currentHome(
	bucket: OverviewBucket,
	ownerId: string,
	deps: Pick<HomeDeps, 'now' | 'sessions'>
): Promise<OwnerHomeSnapshot | null> {
	const stored = await bucket.get(await homeKey(ownerId));
	if (stored) {
		try {
			const { receivedAt, snapshot, publisher } = JSON.parse(await stored.text());
			const age = deps.now - receivedAt;
			if (
				Number.isSafeInteger(receivedAt) &&
				age >= 0 &&
				age <= OVERVIEW_TTL_MS &&
				typeof publisher === 'string' &&
				(await deps.sessions?.publisherLive(publisher, ownerId))
			)
				return parseHomePayload(snapshot);
		} catch {
			// The caller can still use the independently verified overview.
		}
	}
	return null;
}
