import { expect, test } from '../../../../test/support/browserTest';
import { recordedTracker } from '../../test/support/recordedTracker';
import {
	expectEvenHeaderSpacing,
	expectNoSidewaysScroll,
	liveRows,
	macAnswer,
	overview,
	productionHome
} from './hub-home-live-overview-fixture';

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
		const requests = await productionHome(page, await macAnswer(tracker));
		await page.clock.setFixedTime(Date.parse(tracker.recordedAt));
		await page.goto('/');

		const live = tracker.runs.filter((run) => run.ended_at === null);
		await expect(liveRows(page)).toHaveCount(live.length);
		const projects = new Set(tracker.items.map((item) => item.agent));
		await expect(overview(page).getByRole('status')).toHaveText(
			`${live.length} runs live on 2 computers · ${projects.size} projects`
		);
		for (const run of live) {
			const item = tracker.items.find((entry) => entry.id === run.item_id)!;
			const row = liveRows(page).filter({
				has: page.getByText(item.title, { exact: true })
			});
			await expect(row).toBeVisible();
			for (const fact of [
				'Running',
				'Stage: Idea',
				item.owner ?? 'No owner',
				run.node,
				run.effort ? `${run.model}:${run.effort}` : run.model,
				/running (under )?\d+[mhd] · updated .+ ago/
			])
				await expect(row).toContainText(fact);
		}
		for (const agent of projects)
			await expect(
				overview(page).locator('.hh-live-name', { hasText: agent! }).first()
			).toBeAttached();
		await expect(overview(page)).toContainText('over an encrypted connection · read');
		await expectNoSidewaysScroll(page, width);
		if (device === 'phone') await expectEvenHeaderSpacing(page);
		expect(requests.filter((entry) => entry.path === '/api/tracker-overview')).toEqual([]);
		expect(requests.filter((entry) => entry.method === 'PUT')).toEqual([]);
		if (process.env.TAKE_SCREENSHOT)
			await page.screenshot({
				path: test.info().outputPath(`live-overview-${device}.png`),
				fullPage: true
			});
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

	const title = overview(page).getByTitle(item.title);
	await expect(title).toBeVisible();
	const height = async (target: typeof title) => (await target.boundingBox())!.height;
	const other = tracker.runs.filter((entry) => entry.ended_at === null)[1];
	const short = tracker.items.find((entry) => entry.id === other.item_id)!;
	const oneLine = await height(overview(page).getByTitle(short.title, { exact: true }));
	// Two lines at the most, however long the title is.
	expect(await height(title)).toBeLessThanOrEqual(oneLine * 2 + 1);

	// A phone has no tooltip: a tap shows the whole title and the exact times in Lisbon.
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
	// Resting tasks sit after the live ones, behind a button when a project has many.
	const group = overview(page)
		.locator('details')
		.filter({ has: page.locator('summary', { hasText: item.agent! }) });
	if (!(await group.evaluate((node) => (node as HTMLDetailsElement).open)))
		await group.locator('summary').click();
	const more = group.getByRole('button', { name: /^Show all/ });
	if (await more.count()) await more.click();
	const row = overview(page)
		.locator('.hh-live-row')
		.filter({ has: page.getByText(item.title, { exact: true }) });
	await expect(row).toContainText('Finished: done');
	await expect(row).toContainText('Stage: Implementation');
	// The stored Home keeps its slower pace; only the linked computers are asked again.
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

	await expect(overview(page)).toContainText('No linked computer answered');
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
