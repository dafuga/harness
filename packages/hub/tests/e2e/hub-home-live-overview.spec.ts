import type { Page } from '@playwright/test';
import type { HomeWorkProject } from '../../../reports/src/lib/projects-sessions/hub-home/homeLive.types';
import { expect, test } from '../../../../test/support/browserTest';
import { recordedTracker } from '../../test/support/recordedTracker';
import { liveRows, macAnswer, overview, productionHome } from './hub-home-live-fixture';

test.setTimeout(90000);

async function expectNoSidewaysScroll(page: Page, width: number) {
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

async function expectEvenHeaderSpacing(page: Page) {
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

async function expandProjects(page: Page) {
	await expect(overview(page).locator('details.hh-live-project > summary').first()).toBeVisible();
	const summaries = overview(page).locator('details.hh-live-project:not([open]) > summary');
	while (await summaries.count()) await summaries.first().click();
}

async function checkProjectDisclosure(page: Page, projects: HomeWorkProject[], device: string) {
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

for (const [device, width, height] of [
	['desktop', 1440, 900],
	['phone', 390, 844]
] as const) {
	test(`${device}: every project and live run of a recorded Tracker shows with its facts`, async ({
		page
	}) => {
		const tracker = recordedTracker();
		await page.setViewportSize({ width, height });
		const answer = await macAnswer(tracker);
		answer.liveOverview!.machines.push({ name: 'grok-box', status: 'offline' });
		const sample = answer.liveOverview!.projects[0];
		answer.liveOverview!.projects.push({
			...sample,
			agent: 'completed-only',
			running: 0,
			blockedRows: 0,
			totalRows: 1,
			counts: { open: 0, in_progress: 0, blocked: 0, done: 1 },
			rows: []
		});
		const requests = await productionHome(page, answer);
		await page.clock.setFixedTime(Date.parse(tracker.recordedAt));
		await page.goto('/');

		const live = tracker.runs.filter((run) => run.ended_at === null);
		const groups = overview(page).locator('details.hh-live-project');
		await expect(groups.first()).toBeVisible();
		await expect(groups.first().locator(':scope > summary')).toContainText(
			/Running \d+ · Blocked \d+ · Not running \d+/
		);
		await expect(overview(page).locator('details.hh-live-project[open]')).toHaveCount(0);
		await expect(liveRows(page).first()).toBeHidden();
		const alert = page.getByRole('status', { name: 'System alerts' });
		await expect(alert).toContainText('Offline: grok-box');
		await expect(
			page.locator('.hh-system-alert + *').getByRole('heading', { name: 'Blocked - needs you' })
		).toBeVisible();
		await expect(overview(page)).not.toContainText('Offline: grok-box');
		const main = page.getByRole('main');
		await expect(main.locator(':scope > section').last()).toHaveAccessibleName('Live overview');
		expect((await alert.boundingBox())!.y).toBeLessThan(
			(await page.getByRole('heading', { level: 1 }).boundingBox())!.y
		);
		if (process.env.TAKE_SCREENSHOT === 'true') {
			await page.evaluate(() => document.fonts.ready.then(() => {}));
			await page.screenshot({ path: test.info().outputPath(`home-top-${device}.png`) });
			await overview(page).screenshot({
				path: test.info().outputPath(`live-collapsed-${device}.png`)
			});
		}
		await checkProjectDisclosure(page, answer.liveOverview!.projects, device);
		await expandProjects(page);
		await expect(liveRows(page)).toHaveCount(live.length);
		await expect(
			overview(page).locator('.hh-live-row:not([data-state=running]):visible')
		).toHaveCount(0);
		const projects = new Set(tracker.items.map((item) => item.agent));
		await expect(overview(page).getByRole('status')).toHaveText(
			`${live.length} runs live on 2 computers · ${answer.liveOverview!.projects.length} projects`
		);
		for (const run of live) {
			const item = tracker.items.find((entry) => entry.id === run.item_id)!;
			const row = liveRows(page).filter({
				has: page.getByText(item.title, { exact: true })
			});
			await expect(row).toBeVisible();
			for (const fact of [
				'Running',
				item.owner ?? 'No owner',
				run.node,
				run.effort ? `${run.model}:${run.effort}` : run.model,
				/running (under )?\d+[mhd] · updated .+ ago/
			])
				await expect(row).toContainText(fact);
		}
		await overview(page)
			.getByRole('button', { name: /^See all projects/ })
			.click();
		for (const agent of projects)
			await expect(
				overview(page).locator('.hh-live-name', { hasText: agent! }).first()
			).toBeAttached();
		await expect(overview(page)).toContainText('over an encrypted connection · read');
		await expectNoSidewaysScroll(page, width);
		if (device === 'phone') await expectEvenHeaderSpacing(page);
		expect(requests.filter((entry) => entry.path === '/api/tracker-overview')).toEqual([]);
		expect(requests.filter((entry) => entry.method === 'PUT')).toEqual([]);
	});
}

test('a paragraph-long title keeps its row short on a phone', async ({ page }) => {
	const tracker = recordedTracker();
	const run = tracker.runs.find((entry) => entry.ended_at === null)!;
	const item = tracker.items.find((entry) => entry.id === run.item_id)!;
	item.title = 'A long recorded title that keeps going. '.repeat(12).trim();
	await page.setViewportSize({ width: 390, height: 844 });
	await productionHome(page, await macAnswer(tracker));
	await page.clock.setFixedTime(Date.parse(tracker.recordedAt));
	await page.goto('/');

	await expandProjects(page);
	const title = overview(page).getByTitle(item.title);
	await expect(title).toBeVisible();
	const height = async (target: typeof title) => (await target.boundingBox())!.height;
	const other = tracker.runs.filter((entry) => entry.ended_at === null)[1];
	const short = tracker.items.find((entry) => entry.id === other.item_id)!;
	const oneLine = await height(overview(page).getByTitle(short.title, { exact: true }));
	const weight = (target: typeof title) =>
		target.evaluate((node) => getComputedStyle(node).fontWeight);
	expect(await weight(title)).toBe(await weight(overview(page).getByRole('status')));
	expect(await height(title)).toBeLessThanOrEqual(oneLine * 2 + 1);

	await title.click();
	expect(await height(title)).toBeGreaterThan(oneLine * 3);
	const row = overview(page)
		.locator('.hh-live-row')
		.filter({ has: page.getByTitle(item.title) });
	await expect(
		row.getByText(
			/^Started \d{1,2} \w{3,4} \d\d:\d\d · updated \d{1,2} \w{3,4} \d\d:\d\d, Lisbon time$/
		)
	).toBeVisible();
	await expectNoSidewaysScroll(page, 390);
	if (process.env.TAKE_SCREENSHOT)
		await page.screenshot({ path: test.info().outputPath('live-overview-title-open.png') });
});

test('a change on the Mac shows within one turn, also while change notices are connected', async ({
	page
}) => {
	const tracker = recordedTracker();
	const answer = await macAnswer(tracker);
	await page.routeWebSocket('**/api/sync/v1/live', () => {});
	const requests = await productionHome(page, answer, true);
	await page.clock.install({ time: Date.parse(tracker.recordedAt) });
	await page.goto('/');
	const live = tracker.runs.filter((run) => run.ended_at === null);
	await expect(liveRows(page)).toHaveCount(live.length);
	await expect(page.getByRole('status', { name: 'Updates' })).toHaveText('Live');
	const stored = () => requests.filter((entry) => entry.path === '/api/hub-home').length;
	const storedBefore = stored();
	const finished = live[0];
	const item = tracker.items.find((entry) => entry.id === finished.item_id)!;
	finished.ended_at = Date.parse(tracker.recordedAt);
	finished.state = 'finished';
	finished.outcome = 'done';
	item.status = 'done';
	item.stage = 'build';
	Object.assign(answer, await macAnswer(tracker));
	await page.clock.runFor(21_000);

	await expect(liveRows(page)).toHaveCount(live.length - 1);
	const group = overview(page)
		.locator('details.hh-live-project')
		.filter({ has: page.locator('summary.hh-live-head', { hasText: item.agent! }) });
	if (!(await group.evaluate((node) => (node as HTMLDetailsElement).open)))
		await group.locator(':scope > summary').click();
	const more = group.getByRole('button', { name: /^See all/ });
	await more.click();
	await expect(more.or(group.getByRole('button', { name: /^Show fewer/ }))).toHaveAttribute(
		'aria-expanded',
		'true'
	);
	const row = overview(page)
		.locator('.hh-live-row')
		.filter({ has: page.getByText(item.title, { exact: true }) });
	await expect(row).toContainText('Finished: done');
	await expect(row).toContainText('Stage: Implementation');
	expect(stored()).toBe(storedBefore);
});

test('with no computer linked the overview says so and shows no rows', async ({ page }) => {
	await productionHome(page);
	await page.goto('/');
	await expect(overview(page)).toContainText('No computer is linked to this account.');
	await expect(overview(page).locator('.hh-live-row')).toHaveCount(0);
});

test('a linked Mac that is off is reported as not answering', async ({ page }) => {
	await productionHome(page);
	await page.route(/\/api\/remote\/hosts\?linked=1$/, (route) =>
		route.fulfill({
			json: { computers: [{ hostId: 'a'.repeat(40), name: 'Desk Mac', online: false }] }
		})
	);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');

	await expect(page.getByRole('status', { name: 'System alerts' })).toContainText(
		'No linked computer answered'
	);
	await expect(overview(page).locator('.hh-live-row')).toHaveCount(0);
	await expectNoSidewaysScroll(page, 390);
	if (process.env.TAKE_SCREENSHOT)
		await page.screenshot({ path: test.info().outputPath('live-overview-offline.png') });
});

test('a Mac app without the overview is asked to update instead of showing a partial list', async ({
	page
}) => {
	const { liveOverview: _newer, ...older } = await macAnswer(recordedTracker());
	await productionHome(page, older);
	await page.goto('/');
	await expect(overview(page)).toContainText('Update Harness on your Mac');
	await expect(overview(page).locator('.hh-live-row')).toHaveCount(0);
});
