import { expect, test } from '../../../../test/support/browserTest';
import { captureNeedsYou } from './hub-home-capture';
import { recordedTracker } from '../../test/support/recordedTracker';
import {
	checkProjectDisclosure,
	expandProjects,
	expectComputerWorkload,
	expectEvenHeaderSpacing,
	expectLiveDisposition,
	expectLiveRowFacts,
	expectNoSidewaysScroll,
	expectRecordedProjects,
	liveRows,
	macAnswer,
	overview,
	productionHome,
	seedLiveDisposition
} from './hub-home-live-fixture';

test.setTimeout(90000);
for (const [device, width, height] of [
	['desktop', 1440, 900],
	['phone', 390, 844]
] as const) {
	test(`${device}: every project and live run of a recorded Tracker shows with its facts`, async ({
		page
	}) => {
		const tracker = recordedTracker();
		await page.setViewportSize({ width, height });
		tracker.machines.push(
			Object.assign({ node: 'harbor-mbp-2', status: 'overloaded' }, { remote_runs: 2 })
		);
		seedLiveDisposition(tracker);
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

		const live = tracker.runs.filter((run) => run.state === 'running' && run.ended_at === null);
		const groups = overview(page).locator('details.hh-live-project');
		await expect(groups.first()).toBeVisible();
		await expect(groups.first().locator(':scope > summary')).toContainText(
			/Running \d+ · Blocked \d+ · Not running \d+/
		);
		await expect(overview(page).locator('details.hh-live-project[open]')).toHaveCount(0);
		await expect(liveRows(page).first()).toBeHidden();
		const alert = page.getByRole('status', { name: 'System alerts' });
		await expect(alert).toContainText('Offline: grok-box');
		await expect(overview(page)).not.toContainText('Offline: grok-box');
		const main = page.getByRole('main');
		const sections = main.locator(':scope > section');
		await expect(sections.first()).toHaveAccessibleName('Blocked - needs you');
		await expect(sections.last()).toHaveAccessibleName('Live overview');
		expect((await alert.boundingBox())!.y).toBeLessThan(
			(await page.getByRole('heading', { level: 1 }).boundingBox())!.y
		);
		if (process.env.TAKE_SCREENSHOT === 'true') {
			await page.evaluate(() => document.fonts.ready.then(() => {}));
			await page.screenshot({ path: test.info().outputPath(`home-top-${device}.png`) });
		}
		await expectComputerWorkload(page, device);
		await checkProjectDisclosure(page, answer.liveOverview!.projects, device);
		await expandProjects(page);
		await expect(liveRows(page)).toHaveCount(live.length);
		await expect(overview(page).getByRole('status')).toHaveText(
			`${live.length} runs live on 2 computers · ${answer.liveOverview!.projects.length} projects`
		);
		await expectLiveRowFacts(page, tracker);
		await expectRecordedProjects(page, tracker);
		await expandProjects(page);
		await expectLiveDisposition(page, test.info().outputPath(`live-disposition-${device}.png`));
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
	await page.clock.install();
	// The shared Home fixture freezes the date. This case needs time to advance with the timer.
	await page.clock.setSystemTime(Date.parse(tracker.recordedAt));
	await page.goto('/');
	const live = tracker.runs.filter((run) => run.ended_at === null);
	await expect(liveRows(page)).toHaveCount(live.length);
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

	await expect(liveRows(page)).toHaveCount(live.length - 1);
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
		.locator('.hh-live-row')
		.filter({ has: page.getByText(item.title, { exact: true }) });
	await expect(row).toContainText('Finished: done');
	await expect(row).toContainText('Stage: Implementation');
	await expect(page.getByRole('status', { name: 'Updates' })).toHaveText('Live');
	await captureNeedsYou(page, 'live-home-fallback');
	expect(stored(), 'stored Home is re-read on the first quiet live turn').toBe(storedBefore + 1);
	expect(projects(), 'projects are re-read on the first quiet live turn').toBe(projectsBefore + 1);
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
