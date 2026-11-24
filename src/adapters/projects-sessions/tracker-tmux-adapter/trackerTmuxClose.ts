// @harness-uid u_fyf7e7kyi5
import { watchdogManualPrefix } from '../../../services/projects-sessions/WatchdogPaneService';
import type { TrackerTmuxClose, TrackerTmuxPane } from '../TrackerTmuxAdapter.types';
import { matchesTrackerTmuxPane, trackerSessionName } from './trackerTmuxPane';

const managedName = /^auto-[a-z0-9]{6,10}-r[1-9][0-9]*$/;

export function closePaneNames(input: TrackerTmuxClose) {
	const { pane, attempt, observed } = input;
	if (observed) return !attempt && watchdogManualPrefix(pane.name) ? trackerSessionName : null;
	if (!managedName.test(pane.name) || (attempt && !/^[a-f0-9]{64}$/.test(attempt))) return null;
	return managedName;
}

export function closePaneCandidate(input: TrackerTmuxClose, layouts: TrackerTmuxPane[]) {
	const { pane, observed } = input;
	return layouts.find(
		({ pane: candidate }) =>
			(candidate.runnerSocket || observed === true) &&
			!candidate.attached &&
			candidate.name === pane.name &&
			matchesTrackerTmuxPane(candidate, pane)
	);
}
