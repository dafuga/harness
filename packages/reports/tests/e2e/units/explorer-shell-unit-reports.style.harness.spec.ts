import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import { openPreview, readyPreview } from '../support/component-previews/previewPage';

// The console preview applies the notice rules of this stylesheet. Its default state draws none of
// them, so the default state cannot prove this style and is not captured.
const host = 'reports.component.harness-harness-console';
const states = [
	{ id: 'problem', variant: 'index-error' },
	{ id: 'missing', variant: 'missing' }
];

let home = '';
test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));

// The default host is the real fixture opened without a variant. It must draw no notice, and it
// is never captured, so the inapplicable default in the scenario needs no screenshot.
for (const viewport of catalogViewports) {
	test(`reports.style.harness: default host draws no notice at ${viewport.id}`, async ({
		page
	}) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await openPreview(page, home, host);
		await readyPreview(page, host);
		await expect(page.locator('.hc-notice')).toHaveCount(0);
	});
}

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`reports.style.harness:${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await openPreview(page, home, host, state.variant);
			await readyPreview(page, host, state.variant);
			// The notice is the one element the stylesheet's notice rule draws.
			const notice = page.locator('.hc-notice');
			await expect(notice).toHaveCount(1);
			await expect(notice).toHaveCSS('border-left-style', 'solid');
			await expect(notice).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
			if (state.id === 'problem')
				await expect(page.getByRole('alert')).toContainText(
					'The history could not be loaded. Refresh the page to try again.'
				);
			if (state.id === 'missing') {
				await expect(page.getByRole('alert')).toContainText(
					'Branch not-a-real-branch is not in this history.'
				);
				await expect(page.locator('.hc-link')).toHaveText('Open the newest commit');
			}
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
