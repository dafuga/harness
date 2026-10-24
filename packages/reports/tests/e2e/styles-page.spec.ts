import { expect, test } from '../../../../test/support/browserTest';
import { at, expectNoOverflow, expectPath, tip } from './support/explorer';
import { capturePhase, viewports } from './support/harnessCapture';
import { seeded } from './support/harnessHistory';
import {
	documentedStyleTokens,
	expectColorRoles,
	expectStyleGroups,
	expectRoleAssignments
} from './support/styleCatalog';

const { commits } = seeded();

test('Styles navigation preserves the selected branch and commit', async ({ page }) => {
	await page.goto(at('main', commits.approved, 'components'));
	await capturePhase(page, 'styles-navigation');
	const styles = page.getByRole('link', { name: 'Styles', exact: true });
	await expect(styles).toBeVisible();
	await styles.click();
	await expectPath(page, at('main', commits.approved, 'styles'));
	await expect(page.getByRole('heading', { level: 1, name: 'Styles', exact: true })).toBeVisible();
});

for (const viewport of viewports) {
	test(`Styles documents supported design tokens at ${viewport.id} width`, async ({ page }) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await page.goto(tip('main', 'styles'));
		await capturePhase(page, `styles-${viewport.id}`);
		await expectColorRoles(page.locator('main'));

		await expectPath(page, tip('main', 'styles'));
		await expect(
			page.getByRole('heading', { level: 1, name: 'Styles', exact: true })
		).toBeVisible();
		await expectStyleGroups(page.locator('main'));
		await expect(page.locator('[data-style-token]')).toHaveCount(documentedStyleTokens().length);
		for (const name of documentedStyleTokens())
			await expect(page.locator(`[data-style-token="${name}"]`)).toHaveCount(1);
		await expectNoOverflow(page);
		await expectRoleAssignments(page);
	});
}
