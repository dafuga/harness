import { expect, test, type Page } from '../../../../test/support/browserTest';
import { capturePhase, captureScreen, viewports } from './support/harnessCapture';
import {
	NOW,
	allStatesSnapshot,
	emptyReadySnapshot,
	quietOnlySnapshot,
	unavailableSnapshot
} from './support/projectOverviewFixture';
import {
	expectCallouts,
	expectDetailRoundTrip,
	expectEmptyReady,
	expectEtaWords,
	expectEveryStateShown,
	expectFilter,
	expectNoHorizontalScroll,
	expectNoMatch,
	expectOverviewContrast,
	expectPhoneTargets,
	expectPhoneTrimmed,
	expectReadyHeader,
	expectUnavailable
} from './support/projectOverviewAssertions';

const route = '/harness/projects';
const cardStates = [
	['needs-you', 'Atlas'],
	['blocked', 'Beacon'],
	['active', 'Cinder'],
	['quiet', 'Delta'],
	['done', 'Ember']
] as const;
const snapshots = {
	'all-states': allStatesSnapshot,
	'empty-ready': emptyReadySnapshot,
	unavailable: unavailableSnapshot,
	'quiet-only': quietOnlySnapshot
} as const;

/** Serves one synthetic snapshot through the local read, with the clock pinned to NOW. */
async function openWith(page: Page, state: keyof typeof snapshots) {
	await page.clock.setFixedTime(new Date(NOW));
	await page.route('**/api/project-overview', (request) =>
		request.fulfill({ json: snapshots[state]() })
	);
	await page.goto(route, { waitUntil: 'domcontentloaded' });
}

for (const viewport of viewports) {
	test.describe(`reports.module.project-overview-cards at ${viewport.id}`, () => {
		test.use({ viewport: { width: viewport.width, height: viewport.height } });

		test('all-states shows every state, callouts, ETA words and a read-only detail', async ({
			page
		}) => {
			await openWith(page, 'all-states');
			if (process.env.SCREENSHOT_LABEL === 'before') {
				await expect(page.locator('body')).toBeVisible();
				await capturePhase(page, `project-overview-${viewport.id}`);
			}
			await expectReadyHeader(page);
			await expectEveryStateShown(page);
			await expectCallouts(page);
			await expectEtaWords(page);
			await expectOverviewContrast(page);
			await expectDetailRoundTrip(page);
			await expectFilter(page, 'Quiet', ['Delta']);
			await page.getByRole('button', { name: /^All / }).click();
			await expectNoHorizontalScroll(page);
			if (viewport.id === 'mobile') {
				await expectPhoneTargets(page);
				await expectPhoneTrimmed(page);
			}
			await captureScreen(page, 'all-states', viewport);
			if (process.env.SCREENSHOT_LABEL === 'after')
				await capturePhase(page, `project-overview-${viewport.id}`);
		});

		test('empty-ready says the tracker has no projects', async ({ page }) => {
			await openWith(page, 'empty-ready');
			await expectEmptyReady(page);
			await expectNoHorizontalScroll(page);
			await captureScreen(page, 'empty-ready', viewport);
		});

		test('unavailable says the tracker could not be reached', async ({ page }) => {
			await openWith(page, 'unavailable');
			await expectUnavailable(page);
			await expectNoHorizontalScroll(page);
			await captureScreen(page, 'unavailable', viewport);
		});

		test('quiet-only shows a filter with no match as an explicit empty state', async ({ page }) => {
			await openWith(page, 'quiet-only');
			await expect(page.getByRole('article')).toHaveCount(1);
			await expectNoMatch(page);
			await expectNoHorizontalScroll(page);
			await captureScreen(page, 'quiet-only-no-match', viewport);
		});

		test('loading holds the page until the first read answers', async ({ page }) => {
			await page.clock.setFixedTime(new Date(NOW));
			// The read is held open, so the page stays in its loading state for the capture.
			await page.route('**/api/project-overview', () => {});
			await page.goto(route, { waitUntil: 'domcontentloaded' });
			await expect(page.getByRole('status')).toHaveText('Loading projects…');
			await expectNoHorizontalScroll(page);
			await captureScreen(page, 'loading', viewport);
		});

		test('item-detail captures the read-only detail over the page', async ({ page }) => {
			await openWith(page, 'all-states');
			await page
				.getByRole('article', { name: 'Atlas', exact: true })
				.locator('.po-callout[data-kind="attention"] .po-action')
				.click();
			await expect(page.getByRole('dialog')).toContainText('Choose the export column names');
			await captureScreen(page, 'item-detail', viewport);
		});

		for (const [state, name] of cardStates) {
			test(`card ${name} is captured at its own scroll checkpoint`, async ({ page }) => {
				await openWith(page, 'all-states');
				const card = page.getByRole('article', { name, exact: true });
				await card.evaluate((node) => node.scrollIntoView({ block: 'center' }));
				await expect(card).toBeInViewport();
				await captureScreen(page, state, viewport);
			});
		}
	});
}
