import { expect, test } from '../../../../test/support/browserTest';
import { recordedTracker } from '../../test/support/recordedTracker';
import { liveRows, macAnswer, overview, productionHome } from './hub-home-live-fixture';

test.setTimeout(90000);

const milestone =
	'PR #401 open; full check running, merge follows a pass. Browser suite passed on both widths, ' +
	'screenshots are attached to the item, and the release waits for the next window.';

/** A recorded Tracker where one live task reported progress. */
function trackerWithProgress() {
	const tracker = recordedTracker();
	const live = tracker.runs.find((run) => run.ended_at === null)!;
	const working = tracker.items.find((item) => item.id === live.item_id)!;
	working.notes_log = [
		{ at: tracker.recordedAt, text: milestone },
		{ at: tracker.recordedAt, text: 'watchdog context: Session exceeded 150,000 tokens.' }
	];
	return { tracker, working };
}

for (const [device, width, height] of [
	['desktop', 1440, 900],
	['phone', 390, 844]
] as const) {
	test(`${device}: a row says where the work really is, not the default planning stage`, async ({
		page
	}) => {
		const { tracker, working } = trackerWithProgress();
		await page.setViewportSize({ width, height });
		await productionHome(page, await macAnswer(tracker));
		await page.clock.setFixedTime(Date.parse(tracker.recordedAt));
		await page.goto('/');

		await overview(page)
			.locator('details.hh-live-project > summary')
			.filter({ hasText: working.agent! })
			.click();
		const row = liveRows(page).filter({ has: page.getByText(working.title, { exact: true }) });
		// The owner's latest milestone, not the watchdog note written after it.
		await expect(row.locator('.hh-live-now')).toHaveText(milestone);
		await expect(overview(page)).not.toContainText('Stage: Idea');
		if (device === 'phone') {
			// Two lines clip it here, and a phone has no tooltip: a tap on the title shows it all.
			const clipped = () =>
				row.locator('.hh-live-now').evaluate((node) => node.scrollHeight > node.clientHeight + 1);
			expect(await clipped()).toBe(true);
			await row.getByText(working.title, { exact: true }).click();
			await expect.poll(clipped).toBe(false);
		}
		if (process.env.TAKE_SCREENSHOT)
			await row.screenshot({ path: test.info().outputPath(`live-stage-${device}.png`) });
	});
}
