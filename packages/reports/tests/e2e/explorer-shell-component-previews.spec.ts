import { expect, test } from '../../../../test/support/browserTest';
import scenario from '../../../../specification/scenarios/component-previews.json' with { type: 'json' };
import {
	buildShellFixture,
	captureShell,
	openShellPage,
	removeShellFixture
} from './support/shellFixture';
let home = '';
test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['components']);
});
test.afterAll(() => removeShellFixture(home));
for (const viewport of scenario.viewports) {
	for (const state of scenario.states) {
		test(`${state.title} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await openShellPage(page, home, 'components', `?state=${state.id}`);
			await page.evaluate(() => document.fonts.ready.then(() => undefined));
			await expect(page.getByRole('heading', { name: state.title, exact: true })).toBeVisible();
			if (state.id === 'account') {
				const menu = page.getByRole('navigation', { name: 'Account menu' });
				await expect(menu.getByText('Ada Example', { exact: true })).toBeVisible();
				await expect(menu.getByRole('link', { name: 'Members', exact: true })).toHaveAttribute(
					'href',
					'/projects/fixture-project/members'
				);
				await captureShell(page, home, { state: state.id, viewport: viewport.id });
				await menu.getByRole('button', { name: 'Sign out', exact: true }).click();
				await expect(menu.getByText('Ada Example')).toHaveCount(0);
			} else {
				await expect(
					page.getByRole('heading', { name: 'Active model', exact: true })
				).toBeVisible();
				await expect(page.getByText('Pending', { exact: true })).toBeVisible();
				await expect(page.getByText('GPT 6.1', { exact: true })).toBeVisible();
				await expect(page.getByText('Claude Opus 5.5', { exact: true })).toBeVisible();
				await captureShell(page, home, { state: state.id, viewport: viewport.id });
				await page.getByRole('button', { name: 'Cancel pending switch', exact: true }).click();
				await expect(
					page.getByText('Nothing is queued for this session.', { exact: true })
				).toBeVisible();
			}
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);
		});
	}
}
