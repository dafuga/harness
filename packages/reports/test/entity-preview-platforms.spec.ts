import { expect, test } from '../../../test/support/browserTest';
import { capture, fits, open, ready, viewports } from './entityPreviewPage';
import { commits } from './entityUnits';

const platforms = [
	['Web', 'web', 'orders-web'],
	['iOS', 'ios', 'com.example.orders'],
	['Android', 'android', 'No Android native project is registered.'],
	['Desktop (Electron)', 'desktop', 'com.example.orders.desktop']
] as const;

for (const [viewport, size] of Object.entries(viewports)) {
	test(`platforms expose revision-bound deployment setup at ${viewport} width`, async ({ page }) => {
		await page.setViewportSize(size);
		await open(page, {}, 'platforms');
		await ready(page);
		await capture(page, `platforms-entry-${viewport}`);
		const navigation = page.getByRole('navigation', { name: 'Harness categories' });
		await expect(navigation.getByRole('link', { name: 'Platforms', exact: true })).toBeVisible();
		await navigation.getByRole('link', { name: 'Platforms', exact: true }).click();
		await ready(page);
		await capture(page, `platforms-list-${viewport}`);
		await expect(page.getByRole('heading', { level: 1, name: 'Platforms', exact: true })).toBeVisible();
		await expect(page.getByRole('main').getByRole('article')).toHaveCount(4);
		for (const [name, id, value] of platforms) {
			await page.getByRole('link', { name: `View ${name} configuration`, exact: true }).click();
			await ready(page);
			await capture(page, `platforms-${id}-${viewport}`);
			await expect(page).toHaveURL(new RegExp(`/platforms/${id}$`));
			await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
			await expect(page.getByRole('main')).toContainText(value);
			if (id === 'android') {
				await expect(page.getByText('Not configured', { exact: true }).first()).toBeVisible();
				await expect(page.getByRole('heading', { name: 'Commands', exact: true })).toHaveCount(0);
			}
			expect(await fits(page)).toBe(true);
			await page.reload();
			await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
			await page.getByRole('link', { name: 'Platforms', exact: true }).last().click();
		}
		await page.getByRole('combobox', { name: 'Commit', exact: true }).selectOption(commits.first);
		await page.getByRole('link', { name: 'View Web configuration', exact: true }).click();
		await expect(page.getByRole('main')).toContainText('No platform configuration is recorded at this revision.');
		await expect(page.getByRole('main')).not.toContainText('orders-web');
	});
}
