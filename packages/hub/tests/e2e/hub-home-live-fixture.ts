import type { Page } from '@playwright/test';
import { expect } from '../../../../test/support/browserTest';
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

export function seedLiveDisposition(tracker: RecordedTracker) {
	const live = new Set(
		tracker.runs.filter((run) => run.ended_at === null).map((run) => run.item_id)
	);
	const [queued, blocked] = tracker.items.filter((item) => !live.has(item.id));
	queued.status = 'open';
	blocked.status = 'blocked';
	blocked.blocked_reason = 'Waiting on Daniel';
	tracker.runs = tracker.runs.filter(
		(run) => run.item_id !== queued.id && run.item_id !== blocked.id
	);
	tracker.runs.push({
		id: 2000,
		item_id: queued.id,
		node: 'studio-mac',
		model: 'gpt-6.2-sol',
		effort: null,
		state: 'queued',
		outcome: null,
		started_at: null,
		ended_at: null,
		queued_at: Date.parse(tracker.recordedAt),
		failure_reason: 'Tracker host is at session capacity'
	});
}

export async function expectLiveDisposition(page: Page, screenshot: string) {
	const queued = overview(page).locator('.hh-live-row').filter({ hasText: 'Queued #2,000' });
	await expect(queued).toContainText('Waiting for a slot');
	const blocked = overview(page)
		.locator('.hh-live-row[data-state="blocked"]')
		.filter({ hasText: 'Waiting on Daniel' });
	await expect(blocked.first()).toBeVisible();
	await expect(overview(page)).not.toContainText('No live run');
	if (process.env.TAKE_SCREENSHOT) await queued.scrollIntoViewIfNeeded();
	if (process.env.TAKE_SCREENSHOT) await page.screenshot({ path: screenshot });
}

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
