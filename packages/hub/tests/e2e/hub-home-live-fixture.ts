import type { Page } from '@playwright/test';
import { buildHomeLiveOverview } from '../../../reports/src/lib/projects-sessions/hub-home/homeLiveOverview';
import {
	buildHomeSnapshot,
	noProviders
} from '../../../reports/src/lib/projects-sessions/hub-home/homeTrackerProjection';
import { readTrackerSources } from '../../../reports/src/lib/projects-sessions/project-overview/projectOverviewTracker';
import { recordedTrackerFetch, type RecordedTracker } from '../../test/support/recordedTracker';
import { hubHomeFixture } from './hub-home-fixture';
import { linkedComputersFixture } from './linked-computers-fixture';

/** What an updated Mac answers `homeSnapshot` with, built from the recorded Tracker reading. */
export async function macAnswer(tracker: RecordedTracker) {
	const now = Date.parse(tracker.recordedAt);
	const sources = await readTrackerSources(recordedTrackerFetch(tracker), true);
	return {
		...buildHomeSnapshot(sources, noProviders, now),
		liveOverview: buildHomeLiveOverview(sources, now)
	};
}

/** Hub as it runs in production: the owner is signed in and nothing is uploaded or stored. */
export async function productionHome(page: Page, answer?: object, live = false) {
	await hubHomeFixture(page, 'default');
	const requests: { method: string; path: string }[] = [];
	page.on('request', (request) =>
		requests.push({ method: request.method(), path: new URL(request.url()).pathname })
	);
	await page.route('**/api/hub-home', (route) =>
		route.fulfill({ json: { granted: true, snapshot: null, controlled: [], live } })
	);
	if (answer) await linkedComputersFixture(page, answer);
	return requests;
}

export const overview = (page: Page) =>
	page.getByRole('region', { name: 'Live overview', exact: true });
export const liveRows = (page: Page) =>
	overview(page).locator('.hh-live-row[data-state="running"]');
