import { captureNeedsYou } from './hub-home-capture';
import { expect as baseExpect, test } from '../../../../test/support/browserTest';
import { recordedTracker } from '../../test/support/recordedTracker';
import { liveCards, macAnswer, overview, productionHome } from './hub-home-live-fixture';

const expect = baseExpect.configure({ timeout: 20000 });
test.setTimeout(90000);

const proofUrl = 'https://example.test/proof';
const titleUrl = 'https://example.test/decision';
const claim = 'Area claim on dafuga/harness by task (mac): src/launcher';
const milestone =
	'PR #401 open; full check running, merge follows a pass. Browser suite passed on both widths, ' +
	'screenshots are attached to the item, and the release waits for the next window. ' +
	proofUrl;

/** A recorded Tracker where one live task reported progress. */
function trackerWithProgress() {
	const tracker = recordedTracker();
	const live = tracker.runs.find((run) => run.ended_at === null)!;
	const working = tracker.items.find((item) => item.id === live.item_id)!;
	working.title = `Recorded decision ${titleUrl}`;
	working.area_claim = claim;
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
	test(`${device}: a job card opens its latest milestone and proof link`, async ({ page }) => {
		const { tracker, working } = trackerWithProgress();
		await page.setViewportSize({ width, height });
		await productionHome(page, await macAnswer(tracker));
		await page.clock.setFixedTime(Date.parse(tracker.recordedAt));
		await page.goto('/');

		await overview(page)
			.locator('details.hh-live-project > summary')
			.filter({ hasText: working.agent! })
			.click();
		const cardTitle = 'Recorded decision example.test';
		const card = liveCards(page).filter({
			has: page.getByRole('button', { name: cardTitle, exact: true })
		});
		await expect(card).not.toContainText(milestone);
		await expect(card.locator('form, input, textarea, select')).toHaveCount(0);
		await expect(card).not.toContainText(titleUrl);
		await card.getByRole('button', { name: cardTitle, exact: true }).click();
		const detail = page.getByRole('dialog', { name: 'Job details' });
		await expect(detail).toContainText(claim);
		await expect(detail).toContainText(milestone);
		await expect(detail).not.toContainText('Stage: Idea');
		await expect(detail.getByRole('link', { name: proofUrl })).toHaveAttribute('href', proofUrl);
		await expect(detail.getByRole('link', { name: titleUrl })).toHaveAttribute('href', titleUrl);
		await captureNeedsYou(page, `live-card-milestone-${device}`, detail);
	});
}
