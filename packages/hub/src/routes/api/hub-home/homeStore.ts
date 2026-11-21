import type { OwnerHomeSnapshot } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import {
	overviewKey,
	OVERVIEW_TTL_MS,
	readOverview
} from '../tracker-overview/trackerOverviewCache';
import type { OverviewBucket } from '../tracker-overview/trackerOverviewCache.types';
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
	now: number
) {
	await bucket.put(await homeKey(ownerId), JSON.stringify({ snapshot, receivedAt: now }), {
		httpMetadata: { contentType: 'application/json' }
	});
}

export async function readHomeSnapshot(
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
