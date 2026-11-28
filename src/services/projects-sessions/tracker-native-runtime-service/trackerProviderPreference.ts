// @harness-uid u_bl6xl2h4a3
import { z } from 'zod';
import { activePreferenceEnd } from '../../../utils/agents-providers/preferredClaudeRoute';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type { TrackerWireValue } from '../TrackerHubSyncService.types';
import type { TrackerProviderPreference } from './trackerProviderPreference.types';

const metaKey = 'tracker_provider_preference';

/** A cleared preference keeps its time, so clearing on the hub also reaches every computer. */
const stored: z.ZodType<TrackerProviderPreference> = z.object({
	provider: z.literal('claude').nullable(),
	until: z.iso.datetime({ offset: true }).nullable(),
	set_at: z.number()
});

export function readTrackerProviderPreference(
	store: Pick<TrackerPersistenceService, 'getMeta'>
): TrackerProviderPreference | undefined {
	const value = store.getMeta(metaKey);
	return value ? stored.parse(JSON.parse(value)) : undefined;
}

export function writeTrackerProviderPreference(
	store: TrackerPersistenceService,
	preference: TrackerProviderPreference
): void {
	store.writeMeta({ [metaKey]: JSON.stringify(preference) });
}

/** The end of the Claude preference while it is on. */
export function trackerClaudePreferredUntil(
	store: Pick<TrackerPersistenceService, 'getMeta'>,
	now: number
): string | undefined {
	return activePreferenceEnd(readTrackerProviderPreference(store)?.until, now);
}

/** What status and the Hub show; null once cleared or expired. */
export function activeTrackerProviderPreference(
	store: Pick<TrackerPersistenceService, 'getMeta'>,
	now: number
) {
	const preference = readTrackerProviderPreference(store);
	const until = activePreferenceEnd(preference?.until, now);
	return preference && until
		? { provider: 'claude' as const, until, set_at: new Date(preference.set_at).toISOString() }
		: null;
}

/** Take the hub's preference when it was set after the one held here. */
export function observeTrackerProviderPreference(
	store: TrackerPersistenceService,
	policy: TrackerWireValue
): void {
	const incoming = z.object({ provider_preference: stored }).safeParse(policy);
	if (!incoming.success) return;
	const next = incoming.data.provider_preference;
	if (next.set_at <= (readTrackerProviderPreference(store)?.set_at ?? -1)) return;
	writeTrackerProviderPreference(store, next);
}
