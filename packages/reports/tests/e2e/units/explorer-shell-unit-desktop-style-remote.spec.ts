import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import { openPreview, readyPreview } from '../support/component-previews/previewPage';

// desktop.style.remote is imported by design.css, which every desktop catalog preview loads. Each
// state renders a catalog unit whose markup carries one of this stylesheet's own rules.
const states = [
	{
		id: 'default',
		variant: '',
		unit: 'desktop.component.remote-connection',
		selector: '.remote-connection',
		border: 'solid'
	},
	{
		id: 'approval',
		variant: 'read',
		unit: 'desktop.component.remote-approval',
		selector: '.remote-request',
		border: 'solid'
	}
] as const;

let home = '';
test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`desktop.style.remote:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await openPreview(page, home, state.unit, state.variant);
			const content = await readyPreview(page, state.unit, state.variant);
			const rule = content.locator(state.selector).first();
			await expect(rule).toBeVisible();
			await expect(rule).toHaveCSS('display', 'grid');
			await expect(rule).toHaveCSS('border-top-style', state.border);
			await page.evaluate(() => document.fonts.ready.then(() => undefined));
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
