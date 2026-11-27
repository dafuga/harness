import { readTrackerSources } from '../../../reports/src/lib/projects-sessions/project-overview/projectOverviewTracker';
import recording from './hub-home-tracker-recording.json' with { type: 'json' };

// The /items and /runs bodies were recorded from TrackerLocalApiService over a seeded
// in-memory SQLite store. The machine statuses describe that disposable topology.
export const trackerHomeRecording = recording;
export const trackerHomeClock = Date.parse(recording.recordedAt);

export function readRecordedHomeTracker() {
	return readTrackerSources(async (input) => {
		const url = new URL(String(input));
		const path = url.pathname + url.search;
		if (!Object.hasOwn(recording.responses, path))
			throw new Error(`No Tracker response recorded for ${path}`);
		return Response.json(recording.responses[path as keyof typeof recording.responses]);
	}, true);
}
