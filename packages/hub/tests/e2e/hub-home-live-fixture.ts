import type { HomeWorkProject } from '../../../reports/src/lib/projects-sessions/hub-home/homeLive.types';
import { expect, test } from '../../../../test/support/browserTest';
import type { Page } from '@playwright/test';
import { buildHomeLiveOverview } from '../../../reports/src/lib/projects-sessions/hub-home/homeLiveOverview';
import {
	buildHomeSnapshot,
	noProviders
} from '../../../reports/src/lib/projects-sessions/hub-home/homeTrackerProjection';
import { readTrackerSources } from '../../../reports/src/lib/projects-sessions/project-overview/projectOverviewTracker';
import {
	expectedComputerOrder,
	seedLaunchPause,
	recordedTrackerFetch,
	type RecordedTracker
} from '../../test/support/recordedTracker';
import { hubHomeFixture } from './hub-home-fixture';
import { captureNeedsYou } from './hub-home-capture';
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
export const liveCards = (page: Page) =>
	overview(page).locator('.hh-live-card[data-state="running"]');

export function seedLiveDisposition(tracker: RecordedTracker) {
	seedLaunchPause(tracker);
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
	return blocked.title;
}

export async function expectLiveDisposition(page: Page, blockedTitle: string) {
	const region = overview(page);
	const queued = region.locator('.hh-live-card[data-state="queued"]').filter({
		hasText: 'Queued #2,000'
	});
	await queued.getByRole('button').click();
	const detail = page.getByRole('dialog', { name: 'Job details' });
	await expect(detail).toContainText('Waiting for a slot');
	await detail.getByRole('button', { name: 'Close' }).click();
	const blocked = region.locator('.hh-live-card[data-state="blocked"]').filter({
		has: page.getByRole('button', { name: blockedTitle, exact: true })
	});
	await expect(blocked).toContainText('Blocked');
	await expect(blocked).not.toContainText('Waiting on Daniel');
	await blocked.getByRole('button').click();
	await expect(detail).toContainText('Waiting on Daniel');
	await detail.getByRole('button', { name: 'Close' }).click();
	await expect(region).not.toContainText('No live run');
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

export async function expandProjects(page: Page) {
	await expect(overview(page).locator('details.hh-live-project > summary').first()).toBeVisible();
	const summaries = overview(page).locator('details.hh-live-project:not([open]) > summary');
	while (await summaries.count()) await summaries.first().click();
}

export async function checkProjectDisclosure(
	page: Page,
	projects: HomeWorkProject[],
	device: string
) {
	const region = overview(page);
	const names = region.locator('.hh-live-name');
	const active = projects.filter((p) => p.running > 0);
	const waiting = projects.filter(
		(p) => !p.running && (p.counts.open || p.counts.in_progress || p.counts.blocked)
	);
	const idle = projects.filter((p) => !p.running && !waiting.includes(p));
	expect(waiting.length).toBeGreaterThan(0);
	expect(idle.length).toBeGreaterThan(0);
	await expect(names).toHaveText(active.map((p) => p.agent));
	const toggle = region.getByRole('button', {
		name: `See all projects (${projects.length})`,
		exact: true
	});
	if (process.env.TAKE_SCREENSHOT === 'true') {
		await page.evaluate(() => document.fonts.ready.then(() => {}));
		await region.screenshot({
			path: test.info().outputPath(`projects-running-${device}.png`),
			animations: 'disabled'
		});
	}
	await toggle.click();
	await expect(region.getByRole('heading', { name: 'Blocked or open' })).toBeVisible();
	await expect(region.getByRole('heading', { name: 'Nothing in motion' })).toBeVisible();
	await expect(names).toHaveText([...active, ...waiting, ...idle].map((p) => p.agent));
	await expect(region.locator('summary.hh-live-head').last()).toContainText(
		/Running 0 · Blocked 0 · Not running \d+/
	);
	if (process.env.TAKE_SCREENSHOT === 'true')
		await region.screenshot({
			path: test.info().outputPath(`projects-all-${device}.png`),
			animations: 'disabled'
		});
	await region.getByRole('button', { name: 'Show running projects only' }).click();
	await expect(names).toHaveText(active.map((p) => p.agent));
}

export async function expectLiveCardFacts(page: Page, tracker: RecordedTracker) {
	const live = tracker.runs.filter((run) => run.state === 'running' && run.ended_at === null);
	for (const run of live) {
		const item = tracker.items.find((entry) => entry.id === run.item_id)!;
		const card = liveCards(page).filter({
			has: page.getByText(item.title, { exact: true })
		});
		await expect(card).toBeVisible();
		for (const fact of [
			'Running',
			run.node,
			run.effort ? `${run.model}:${run.effort}` : run.model,
			/updated (under )?\d+[mhd] ago/
		])
			await expect(card).toContainText(fact);
	}
}

export async function expectRecordedProjects(page: Page, tracker: RecordedTracker) {
	await overview(page)
		.getByRole('button', { name: /^See all projects/ })
		.click();
	const projects = new Set(tracker.items.map((item) => item.agent));
	for (const agent of projects)
		await expect(
			overview(page).locator('.hh-live-name', { hasText: agent! }).first()
		).toBeAttached();
}

export async function expectComputerWorkload(page: Page, device: string, titles: string[]) {
	const computers = page.getByRole('list', { name: 'Computers' });
	const computer = computers.getByRole('listitem').filter({ hasText: 'harbor-mbp-2' });
	await expect(computer).toBeVisible();
	await page.evaluate(() => window.scrollTo(0, 0));
	await captureNeedsYou(page, `host-work-${device}`);
	await expect(computers.getByRole('button')).toHaveText(
		expectedComputerOrder.map((name) => new RegExp(`^\\s*${name} ·`))
	);
	await expect(computer).toContainText('2 agents');
	const trigger = computer.getByRole('button');
	await trigger.click();
	const detail = page.getByRole('dialog', { name: 'harbor-mbp-2' });
	await expect(detail).toBeVisible();
	await captureNeedsYou(page, `host-detail-${device}`);
	await expect(detail).toContainText('memory pressure is critical');
	await expect(detail).toContainText('12 GB free of 64 GB');
	await expect(detail).toContainText('3.5 load / 10 cores');
	await expect(detail).toContainText('6.5 estimated free cores');
	await expect(detail).toContainText('45.5 GB free');
	for (const title of titles) await expect(detail.getByText(title)).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(detail).toBeHidden();
	await expect(trigger).toBeFocused();
	await expect(page.getByRole('button', { name: /travel-mac.*5 agents/ })).toBeVisible();
	const offline = page.getByRole('button', { name: /grok-box.*offline/ });
	await offline.click();
	const offlineDetail = page.getByRole('dialog', { name: 'grok-box' });
	await expect(offlineDetail).toContainText('No current resource reading');
	await offlineDetail.getByRole('button', { name: 'Close' }).click();
	await expect(offline).toBeFocused();
}
