import { expect, test } from '../../../../../test/support/browserTest';
import { buildShellFixture, captureShell, removeShellFixture } from '../support/shellFixture';
import { catalogViewports } from '../support/component-previews/catalogUnits';
import { openPreview, readyPreview } from '../support/component-previews/previewPage';

/** The contract table is the catalog preview that applies this unit's info button rules. */
const host = 'reports.component.contract-table';
const transparent = 'rgba(0, 0, 0, 0)';
const states = [
	{ id: 'default', variant: '' },
	{ id: 'focused', variant: 'focused' },
	{ id: 'hovered', variant: 'hovered' },
	{ id: 'touch', variant: '' }
];

let home = '';
test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));

for (const viewport of catalogViewports) {
	for (const state of states) {
		test(`reports.component.shared-primitives-contract-table-info:${state.id} at ${viewport.id}`, async ({
			page
		}) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			if (state.id === 'touch') {
				// A coarse pointer is what the unit's larger touch target is declared for.
				const cdp = await page.context().newCDPSession(page);
				await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
			}
			await openPreview(page, home, host, state.variant);
			const content = await readyPreview(page, host, state.variant);
			const info = content.locator('[data-harness-component="contract-table"] .info').first();
			await expect(info).toBeVisible();

			if (state.id === 'focused') {
				await info.focus();
				await expect.poll(() => info.evaluate((node) => node.matches(':focus-visible'))).toBe(true);
				await expect(info).toHaveCSS('outline-style', 'solid');
			}
			if (state.id === 'hovered') {
				await info.hover();
				await expect(info).not.toHaveCSS('border-top-color', transparent);
			}
			if (state.id === 'default') await expect(info).toHaveCSS('border-top-color', transparent);
			if (state.id === 'touch') {
				expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
			}

			const size = state.id === 'touch' ? '44px' : '32px';
			await expect(info).toHaveCSS('width', size);
			await expect(info).toHaveCSS('height', size);

			await captureShell(page, home, { state: state.id, viewport: viewport.id });
		});
	}
}
