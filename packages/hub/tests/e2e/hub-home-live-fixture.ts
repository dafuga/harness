import { expect, type Page } from '../../../../test/support/browserTest';
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

export async function expectNoSidewaysScroll(page: Page, width: number) {
	const wide = await page.evaluate(() => {
		const rows = [...document.querySelectorAll('.hh-live-overview *')];
		return {
			page: document.documentElement.scrollWidth,
			right: Math.max(...rows.map((node) => node.getBoundingClientRect().right))
		};
	});
	expect(wide.page).toBeLessThanOrEqual(width);
	expect(wide.right).toBeLessThanOrEqual(width);
}

export async function expandProjects(page: Page) {
	await expect(overview(page).locator('details.hh-live-project > summary').first()).toBeVisible();
	const summaries = overview(page).locator('details.hh-live-project:not([open]) > summary');
	while (await summaries.count()) await summaries.first().click();
}

export async function expectEvenHeaderSpacing(page: Page) {
	const [heading, summary, source] = await Promise.all(
		[
			overview(page).getByRole('heading', { name: 'Live overview' }),
			overview(page).getByRole('status'),
			overview(page).getByText(/^From \d+ of /)
		].map(async (line) => (await line.boundingBox())!)
	);
	const above = summary.y - (heading.y + heading.height);
	const below = source.y - (summary.y + summary.height);
	expect(Math.abs(below - above)).toBeLessThanOrEqual(2);
	expect(below).toBeLessThanOrEqual(8);
}
