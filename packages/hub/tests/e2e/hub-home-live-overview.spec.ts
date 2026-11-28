import { expect as baseExpect, test, type Page } from '../../../../test/support/browserTest';
import { captureNeedsYou } from './hub-home-capture';
import { recordedTracker, seedComputerWork } from '../../test/support/recordedTracker';
import {
	checkProjectDisclosure,
	expandProjects,
	expectComputerWorkload,
	expectEvenHeaderSpacing,
	expectLiveDisposition,
	expectLiveCardFacts,
	expectNoSidewaysScroll,
	expectRecordedProjects,
	liveCards,
	macAnswer,
	overview,
	productionHome,
	seedLiveDisposition
} from './hub-home-live-fixture';
const expect = baseExpect.configure({ timeout: 20000 });
test.setTimeout(90000);
for (const [device, width, height] of [
	['desktop', 1440, 900],
	['phone', 390, 844],
	['tablet', 834, 1194],
	['desktop-dark', 1440, 900],
	['phone-light', 390, 844]
] as const) {
	test(`${device}: recorded Tracker jobs appear as cards below Home priorities`, async ({
		page
	}) => {
		const tracker = recordedTracker();
		await page.setViewportSize({ width, height });
		const remoteTitles = seedComputerWork(tracker);
		await page.emulateMedia({
			colorScheme: ['phone', 'desktop-dark'].includes(device) ? 'dark' : 'light'
		});
		Object.assign(tracker.machines.find(({ node }) => node === 'harbor-mbp-2')!, {
			utilization: { actual: { cpu: 42, ram: 61 }, target: { cpu: 80, ram: 75 } }
		});
		const blockedTitle = seedLiveDisposition(tracker);
		const answer = await macAnswer(tracker);
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
		const navigation = await page.goto('/');

		const live = tracker.runs.filter((run) => run.state === 'running' && run.ended_at === null);
		const groups = overview(page).locator('details.hh-live-project');
		await expect(groups.first()).toBeVisible();
		await expect(groups.first().locator(':scope > summary')).toContainText(
			/Running \d+ · Blocked \d+ · Not running \d+/
		);
		await expect(overview(page).locator('details.hh-live-project[open]')).toHaveCount(0);
		await expect(overview(page).getByRole('listitem').first()).toBeHidden();
		const alert = page.getByRole('status', { name: 'System alerts' });
		await expect(alert).toContainText('Offline: grok-box');
		await expect(overview(page)).not.toContainText('Offline: grok-box');
		const main = page.getByRole('main');
		const sections = main.locator(':scope > section');
		await expect(sections.first()).toHaveAccessibleName('Blocked - needs you');
		await expect(sections.last()).toHaveAccessibleName('Live overview');
		await expectLivePlacement(page);
		expect((await alert.boundingBox())!.y).toBeLessThan(
			(await page.getByRole('heading', { level: 1 }).boundingBox())!.y
		);
		if (process.env.TAKE_SCREENSHOT === 'true') {
			await page.evaluate(() => document.fonts.ready.then(() => {}));
			await page.screenshot({ path: test.info().outputPath(`home-top-${device}.png`) });
		}
		await expectComputerWorkload(page, device, remoteTitles);
		if (process.env.TAKE_SCREENSHOT === 'true')
			await recordRendererMetrics(page, device, navigation?.request().timing().responseEnd);
		await expect(page.getByRole('list', { name: 'Computers' })).toContainText(
			/CPU 42% \/ 80% ·\s+RAM 61% \/ 75% target/
		);
		await checkProjectDisclosure(page, answer.liveOverview!.projects, device);
		await expandProjects(page);
		const busiest = answer.liveOverview!.projects.find((project) => project.running >= 5)!;
		const grid = overview(page).getByRole('list', { name: `${busiest.agent} running jobs` });
		await captureNeedsYou(page, `live-grid-${device}`, grid);
		await expectCardGrid(grid, width);
		await expect(liveCards(page)).toHaveCount(live.length);
		await expect(overview(page).getByRole('status')).toHaveText(
			`${live.length} runs live on 2 computers · ${answer.liveOverview!.projects.length} projects`
		);
		await expectLiveCardFacts(page, tracker);
		await expectRecordedProjects(page, tracker);
		await expandProjects(page);
		await expectLiveDisposition(page, blockedTitle);
		await expect(overview(page)).toContainText('over an encrypted connection · read');
		await expectNoSidewaysScroll(page, width);
		if (width === 390) await expectEvenHeaderSpacing(page);
		expect(requests.filter((entry) => entry.path === '/api/tracker-overview')).toEqual([]);
		expect(requests.filter((entry) => entry.method === 'PUT')).toEqual([]);
	});
}

async function expectLivePlacement(page: Page) {
	const live = overview(page);
	const priorities = [
		page.getByRole('region', { name: 'Blocked - needs you' }),
		page.getByRole('region', { name: 'Chief of Staff', exact: true }),
		page.getByRole('list', { name: 'Computers' }),
		page.getByRole('region', { name: 'Quota', exact: true })
	];
	for (const panel of priorities) {
		await expect(panel).toBeVisible();
		expect((await panel.boundingBox())!.y + (await panel.boundingBox())!.height).toBeLessThan(
			(await live.boundingBox())!.y
		);
	}
}

async function expectCardGrid(grid: ReturnType<Page['getByRole']>, width: number) {
	const boxes = await grid.getByRole('listitem').evaluateAll((items) =>
		items.map((item) => {
			const { top, width, height } = item.getBoundingClientRect();
			return { top, width, height };
		})
	);
	expect(boxes.length).toBeGreaterThanOrEqual(5);
	const firstRow = boxes.filter(({ top }) => top === boxes[0].top);
	expect(firstRow.length, 'Jobs share a horizontal row').toBeGreaterThanOrEqual(
		width > 1000 ? 3 : 2
	);
	expect(firstRow.length).toBeLessThanOrEqual(width > 1000 ? 5 : 2);
	for (const { width, height } of firstRow) {
		expect(height / width).toBeGreaterThanOrEqual(0.85);
		expect(height / width).toBeLessThanOrEqual(1.2);
	}
}

async function recordRendererMetrics(page: Page, device: string, responseEndMs?: number) {
	const cdp = await page.context().newCDPSession(page);
	try {
		await cdp.send('Performance.enable');
		const { metrics } = await cdp.send('Performance.getMetrics');
		const usedHeap = metrics.find(({ name }) => name === 'JSHeapUsedSize');
		console.log(
			'Home renderer',
			device,
			JSON.stringify({ responseEndMs, pageHeapBytes: usedHeap?.value })
		);
	} finally {
		await cdp.detach();
	}
}

test('a paragraph-long title stays compact and opens full details on a phone', async ({ page }) => {
	const tracker = recordedTracker();
	const run = tracker.runs.find((entry) => entry.ended_at === null)!;
	const item = tracker.items.find((entry) => entry.id === run.item_id)!;
	item.title = 'A long recorded title that keeps going. '.repeat(12).trim();
	await page.setViewportSize({ width: 390, height: 844 });
	await productionHome(page, await macAnswer(tracker));
	await page.clock.setFixedTime(Date.parse(tracker.recordedAt));
	await page.goto('/');

	await expandProjects(page);
	const title = overview(page).getByTitle(item.title, { exact: true });
	await expect(title).toBeVisible();
	expect(await title.evaluate((node) => getComputedStyle(node).webkitLineClamp)).toBe('2');
	const trigger = overview(page).getByRole('button', { name: item.title, exact: true });
	await trigger.focus();
	await trigger.press('Enter');
	const detail = page.getByRole('dialog', { name: 'Job details' });
	await expect(detail.getByRole('heading', { name: item.title })).toBeVisible();
	await expect(detail.getByText(/Started .+ · updated .+, Lisbon time/)).toBeVisible();
	await captureNeedsYou(page, 'live-card-detail-phone', detail);
	await page.keyboard.press('Escape');
	await expect(detail).toBeHidden();
	await expect(trigger).toBeFocused();
	await expectNoSidewaysScroll(page, 390);
});

test('a change on the Mac shows within one turn, also while change notices are connected', async ({
	page
}) => {
	const tracker = recordedTracker();
	const answer = await macAnswer(tracker);
	await page.routeWebSocket('**/api/sync/v1/live', () => {});
	const requests = await productionHome(page, answer, true);
	await page.clock.install();
	// The shared Home fixture freezes the date. This case needs time to advance with the timer.
	await page.clock.setSystemTime(Date.parse(tracker.recordedAt));
	await page.goto('/');
	const live = tracker.runs.filter((run) => run.ended_at === null);
	await expect(liveCards(page)).toHaveCount(live.length);
	await expect(page.getByRole('status', { name: 'Updates' })).toHaveText('Live');
	const stored = () => requests.filter((entry) => entry.path === '/api/hub-home').length;
	const projects = () => requests.filter((entry) => entry.path === '/api/projects').length;
	const storedBefore = stored();
	const projectsBefore = projects();
	const lastSession = answer.liveOverview!.projects.find((project) => project.running === 1)!;
	const itemId = lastSession.rows.find((row) => row.state === 'running')!.itemId;
	const finished = live.find((run) => run.item_id === itemId)!;
	const item = tracker.items.find((entry) => entry.id === finished.item_id)!;
	finished.ended_at = Date.parse(tracker.recordedAt);
	finished.state = 'finished';
	finished.outcome = 'done';
	item.status = 'done';
	item.stage = 'build';
	Object.assign(answer, await macAnswer(tracker));
	await page.clock.runFor(20_000);

	await expect(liveCards(page)).toHaveCount(live.length - 1);
	const group = overview(page)
		.locator('details.hh-live-project')
		.filter({ has: page.locator('summary.hh-live-head', { hasText: item.agent! }) });
	await expect(group).toHaveCount(0);
	await overview(page)
		.getByRole('button', { name: /^See all projects/ })
		.click();
	await expect(group.locator(':scope > summary')).toContainText('Running 0');
	if (!(await group.evaluate((node) => (node as HTMLDetailsElement).open)))
		await group.locator(':scope > summary').click();
	const more = group.getByRole('button', { name: /^See all/ });
	await more.click();
	await expect(more.or(group.getByRole('button', { name: /^Show fewer/ }))).toHaveAttribute(
		'aria-expanded',
		'true'
	);
	const row = overview(page)
		.locator('.hh-live-card')
		.filter({ has: page.getByText(item.title, { exact: true }) });
	await expect(row).toContainText('Done');
	await row.getByRole('button', { name: item.title, exact: true }).click();
	const detail = page.getByRole('dialog', { name: 'Job details' });
	await expect(detail).toContainText('Finished: done');
	await expect(detail).toContainText('Stage: Implementation');
	await detail.getByRole('button', { name: 'Close' }).click();
	await expect(page.getByRole('status', { name: 'Updates' })).toHaveText('Live');
	await captureNeedsYou(page, 'live-home-fallback');
	expect(stored(), 'stored Home is re-read on the first quiet live turn').toBe(storedBefore + 1);
	expect(projects(), 'projects are re-read on the first quiet live turn').toBe(projectsBefore + 1);
});

test('with no computer linked the overview says so and shows no rows', async ({ page }) => {
	await productionHome(page);
	await page.goto('/');
	await expect(overview(page)).toContainText('No computer is linked to this account.');
	await expect(overview(page).locator('.hh-live-card')).toHaveCount(0);
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
	await expect(overview(page).locator('.hh-live-card')).toHaveCount(0);
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
	await expect(overview(page).locator('.hh-live-card')).toHaveCount(0);
});
