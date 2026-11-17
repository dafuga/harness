import { expect, test } from '../../../../../test/support/browserTest';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import {
	evidenceRequested,
	recordCapture
} from '../../../../../src/utils/reports-media/record-capture/recordCapture';

/**
 * The page renders one screen for every address it serves, so it has one state: the explorer
 * screen with its content. It is opened on the real route of the reports server, because the
 * shell fixture does not serve this route, and captured there.
 */
const states = [{ id: 'default', variant: '' }];
const address = '/harness/not-a-console-page';

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`reports.page.harness-view:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await page.goto(address);
			await expect(page).toHaveTitle('Explorer · Harness');
			await expect(page.locator('.ex-content')).toBeVisible();
			await page.evaluate(() => document.fonts.ready.then(() => undefined));
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);
			if (!evidenceRequested()) return;
			const health = (await (await page.request.get('/api/health')).json()) as {
				buildId?: string;
				revision?: string | null;
			};
			const server =
				health.buildId && health.revision
					? { buildId: health.buildId, revision: health.revision }
					: undefined;
			const bytes = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
			recordCapture(
				{
					evidence: 'screens',
					kind: 'screenshot',
					state: state.id,
					viewport: viewport.id,
					file: `${state.id}-${viewport.id}.png`,
					mediaType: 'image/png',
					provenance: 'actual-capture',
					...(server ? { server } : {})
				},
				bytes
			);
		});
	}
}
