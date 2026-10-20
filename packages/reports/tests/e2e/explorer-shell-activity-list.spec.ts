import { expect, test } from '../../../../test/support/browserTest';
import scenario from '../../../../specification/scenarios/activity-list-states.json' with { type: 'json' };
import {
	buildShellFixture,
	captureShell,
	openShellPage,
	removeShellFixture
} from './support/shellFixture';

let home = '';
test.beforeAll(() => {
	test.setTimeout(180_000);
	home = buildShellFixture(['activity']);
});
test.afterAll(() => removeShellFixture(home));
const counts: Record<string, number> = { empty: 0, short: 2, error: 1, expanded: 7 };

for (const viewport of scenario.viewports) {
	for (const state of scenario.states) {
		test(`Activity List ${state.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await openShellPage(page, home, 'activity', `?state=${state.id}`);
			const list = page.getByRole('list', { name: 'Recent activity', exact: true });
			if (state.id === 'expanded')
				await page.getByRole('button', { name: 'Show all 7 activities', exact: true }).click();
			await page.evaluate(() => document.fonts.ready.then(() => undefined));
			await captureShell(page, home, { state: state.id, viewport: viewport.id });
			await expect(list.locator(':scope > li:visible')).toHaveCount(counts[state.id] ?? 3);
			if (state.id === 'error')
				await expect(page.getByRole('alert')).toContainText('Could not read recent activity.');
			if (state.id === 'ordered') expect(await list.evaluate((node) => node.tagName)).toBe('OL');
			if (state.id === 'expanded')
				await expect(page.getByRole('button', { name: 'Show fewer activities' })).toHaveAttribute(
					'aria-expanded',
					'true'
				);
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);
		});
	}
}
