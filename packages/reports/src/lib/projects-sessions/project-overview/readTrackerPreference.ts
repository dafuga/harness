// @harness-uid u_3spz5aua5q
import { z } from 'zod';
import type { HomeProviderPreference } from '../hub-home/hubHome.types';
import { getTrackerJson } from './trackerJsonRead';
import { TRACKER_GET_URLS } from './trackerReadTargets';

const reply = z.object({
	provider_preference: z
		.object({ provider: z.literal('claude'), until: z.iso.datetime({ offset: true }) })
		.nullable()
});

/** An older Tracker has no preference route; Home is still complete without it. */
export async function readTrackerPreference(
	fetcher: typeof fetch
): Promise<HomeProviderPreference | undefined> {
	try {
		const value = await getTrackerJson(fetcher, TRACKER_GET_URLS.providerPreference);
		return reply.parse(value).provider_preference ?? undefined;
	} catch {
		return undefined;
	}
}
