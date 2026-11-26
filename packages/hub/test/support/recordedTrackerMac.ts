import { vi } from 'vitest';
import { createHomeSnapshotReader } from '../../../desktop/src/lib/development-tooling/desktop-initialization/tracker-overview-publisher/createHomeSnapshotReader';
import { recordedTrackerFetch } from './recordedTracker';
import type { RecordedTracker } from './recordedTracker.types';

/**
 * What the real Mac reader answers over the encrypted connection, as it arrives: through JSON.
 * Kept apart from the recording, which browser specs also load without Vitest.
 */
export async function recordedMacAnswer(tracker: RecordedTracker) {
	vi.stubGlobal('fetch', recordedTrackerFetch(tracker));
	return JSON.parse(JSON.stringify(await createHomeSnapshotReader(undefined, [])()));
}
