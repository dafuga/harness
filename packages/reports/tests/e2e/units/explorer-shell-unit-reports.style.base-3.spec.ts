import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import { openPreview, readyPreview } from '../support/component-previews/previewPage';

/** The catalog preview whose document loads the base-3 stylesheet with the other reports styles. */
const host = 'reports.component.activity-list';
/** base-3 only styles the report screens, which no catalog component renders, so one state. */
const states = [{ id: 'default', variant: '' }];

let home = '';
test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`reports.style.base-3:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await openPreview(page, home, host, state.variant);
			await readyPreview(page, host, state.variant);
			// A rule that only base-3 declares must be loaded into the host document.
			const loaded = await page.evaluate(() =>
				Array.from(document.styleSheets).some((sheet) => {
					try {
						return Array.from(sheet.cssRules).some(
							(rule) => (rule as CSSStyleRule).selectorText === '.outcome-strip.has-gaps'
						);
					} catch {
						return false;
					}
				})
			);
			expect(loaded).toBe(true);
			// The root background comes from the shared token that base-3 sets on the root element.
			expect(
				await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)
			).not.toBe('rgba(0, 0, 0, 0)');
			await page.evaluate(() => document.fonts.ready.then(() => undefined));
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
