// @harness-uid u_bl6xl2h4a3
import { z } from 'zod';
import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import {
	clearTrackerQuotaHold,
	trackerProviderHold,
	trackerProviders
} from './trackerProviderHolds';
import {
	activeTrackerProviderPreference,
	readTrackerProviderPreference,
	writeTrackerProviderPreference
} from './trackerProviderPreference';

export const duePauseKey = 'due_scheduler_paused';

/** The operator's launch switches for this computer. */
export function trackerAutolaunchAdmin(
	store: TrackerPersistenceService,
	{ role, now }: { role: 'hub' | 'spoke'; now: () => number }
) {
	return {
		pauseDue(paused: boolean) {
			if (role !== 'hub')
				throw trackerItemError('run tracker autolaunch pause or resume on the hub', 409);
			store.writeMeta({ [duePauseKey]: paused ? '1' : '0' });
			return { paused };
		},
		/** On the hub this reaches every computer; on another computer only that one. */
		prefer(request: unknown) {
			writeTrackerProviderPreference(store, preferenceFrom(request, now()));
			return {
				provider_preference: activeTrackerProviderPreference(store, now()),
				applies_to: role === 'hub' ? 'every computer that syncs with this hub' : store.node
			};
		},
		clearQuota(provider: unknown) {
			const cli = trackerProviders.find((name) => name === provider);
			if (!cli) throw trackerItemError('quota provider must be codex or claude', 400);
			clearTrackerQuotaHold(store, cli);
			return {
				provider: cli,
				cleared: true,
				waiting_on: trackerProviderHold(store, cli, now())
			};
		}
	};
}

function preferenceFrom(request: unknown, now: number) {
	const { provider, until } = (request ?? {}) as { provider?: unknown; until?: unknown };
	if (provider === null) return { provider, until: null, set_at: now };
	const end = z.iso.datetime({ offset: true }).safeParse(until).data;
	if (provider !== 'claude' || !end || Date.parse(end) <= now)
		throw trackerItemError('prefer claude needs a future ISO --until time with an offset', 400);
	return { provider: 'claude' as const, until: new Date(end).toISOString(), set_at: now };
}

/** What the hub tells each spoke with every journal pull. */
export function trackerHubDuePolicy(store: TrackerPersistenceService, now: () => number) {
	return () => {
		const preference = readTrackerProviderPreference(store);
		return {
			paused: store.getMeta(duePauseKey) === '1',
			at: now(),
			...(preference && { provider_preference: preference })
		};
	};
}
