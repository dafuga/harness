import type { OverviewSnapshot } from './projectOverview.types';
import { projectOverviewSnapshot } from './projectOverviewSnapshot';
import { readTrackerSources } from './projectOverviewTracker';

/**
 * Read the local tracker through its fixed GET operations and project the overview.
 * A timeout, refusal, redirect, non-success status or malformed record reads as unavailable.
 */
export async function readProjectOverview(
	fetcher: typeof fetch = globalThis.fetch,
	now: number = Date.now()
): Promise<OverviewSnapshot> {
	try {
		const sources = await readTrackerSources(fetcher);
		return projectOverviewSnapshot(sources, now);
	} catch {
		return { status: 'unavailable' };
	}
}
