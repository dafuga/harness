import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RecordedTracker } from './recordedTracker.types';
export type { RecordedTracker } from './recordedTracker.types';

/**
 * A real Tracker reading of 2026-11-26 with every name and free text replaced: 49 items and 79
 * runs, 17 of them live on two computers. Each call returns a copy a test may change.
 */
export function recordedTracker(): RecordedTracker {
	const file = resolve(import.meta.dirname, 'recordedTracker.json');
	return JSON.parse(readFileSync(file, 'utf8')) as RecordedTracker;
}

/** The three Tracker reads the Mac issues, answered from a recording. */
export function recordedTrackerFetch(tracker: RecordedTracker): typeof fetch {
	return (async (target: string | Request | URL) => {
		const path = new URL(String(target)).pathname;
		if (path === '/items') return Response.json(tracker.items);
		if (path === '/runs') return Response.json(tracker.runs);
		if (path === '/machines') return Response.json(tracker.machines);
		throw new Error(`unexpected Tracker read: ${path}`);
	}) as typeof fetch;
}
