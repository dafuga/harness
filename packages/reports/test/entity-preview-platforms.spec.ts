import { expect, test } from '../../../test/support/browserTest';
import { capture, fits, open, ready, viewports } from './entityPreviewPage';
import { commits } from './entityUnits';
import { startRoute } from './entityPreviewPlatformEvidence';

const platforms = [
	['Web', 'web', 'orders-web'],
	['iOS', 'ios', 'com.example.orders'],
	['Android', 'android', 'No Android native project is registered.'],
	['Desktop (Electron)', 'desktop', 'com.example.orders.desktop']
] as const;

for (const [viewport, size] of Object.entries(viewports)) {
	test(`platforms expose revision-bound deployment setup at ${viewport} width`, async ({
		page
	}) => {
		await page.setViewportSize(size);
		await open(page, {}, 'platforms');
		await ready(page);
		await capture(page, `platforms-entry-${viewport}`);
		const navigation = page.getByRole('navigation', { name: 'Harness categories' });
		await expect(navigation.getByRole('link', { name: 'Platforms', exact: true })).toBeVisible();
		await startRoute(page);
		await navigation.getByRole('link', { name: 'Platforms', exact: true }).click();
		await ready(page);
		await capture(page, `platforms-list-${viewport}`);
		await expect(
			page.getByRole('heading', { level: 1, name: 'Platforms', exact: true })
		).toBeVisible();
		await expect(page.getByRole('main').getByRole('article')).toHaveCount(4);
		for (const [name, id, value] of platforms) {
			await startRoute(page);
			await page.getByRole('link', { name: `View ${name} configuration`, exact: true }).click();
			await ready(page);
			await capture(page, `platforms-${id}-${viewport}`);
			await expect(page).toHaveURL(new RegExp(`/platforms/${id}$`));
			await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
			await expect(page.getByRole('main')).toContainText(value);
			if (id === 'web') {
				await expect(
					page.getByRole('link', { name: 'wrangler.jsonc', exact: true })
				).toHaveAttribute(
					'href',
					`https://github.com/example/orders/blob/${commits.tip}/wrangler.jsonc`
				);
				await expect(page.getByRole('main')).toContainText('ORDERS_GITHUB_CLIENT_SECRET');
			}
			if (id === 'android') {
				await expect(page.getByText('Not configured', { exact: true }).first()).toBeVisible();
				await expect(page.getByRole('heading', { name: 'Commands', exact: true })).toHaveCount(0);
			}
			expect(await fits(page)).toBe(true);
			await page.reload();
			await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
			await page.getByRole('link', { name: 'Platforms', exact: true }).last().click();
		}
		await startRoute(page);
		await page.getByRole('combobox', { name: 'Commit', exact: true }).selectOption(commits.first);
		await page.getByRole('link', { name: 'View Web configuration', exact: true }).click();
		await expect(page.getByRole('main')).toContainText(
			'No platform configuration is recorded at this revision.'
		);
		await expect(page.getByRole('main')).not.toContainText('orders-web');
		await capture(page, `platforms-missing-${viewport}`);
	});
}

test('platform search and the shared status filter narrow the list independently', async ({
	page
}) => {
	await page.setViewportSize(viewports.mobile);
	await open(page, {}, 'platforms');
	await page
		.getByRole('navigation', { name: 'Harness categories' })
		.getByRole('link', { name: 'Platforms', exact: true })
		.click();
	const articles = page.getByRole('main').getByRole('article');
	const search = page.getByRole('searchbox', { name: 'Search platforms', exact: true });
	await search.fill('iphone');
	await expect(articles).toHaveCount(1);
	await expect(articles).toContainText('iOS');
	await search.fill('');
	await page.getByRole('button', { name: 'Filters', exact: true }).click();
	const filters = page.getByRole('dialog', { name: 'Filters', exact: true });
	await filters.getByRole('combobox').selectOption('configured');
	await capture(page, 'platforms-status-filter-mobile');
	await filters.getByRole('button', { name: 'Done', exact: true }).click();
	await expect(articles).toHaveCount(2);
	await page.getByRole('button', { name: 'Filters', exact: true }).click();
	await filters.getByRole('button', { name: 'Reset filters', exact: true }).click();
	await filters.getByRole('button', { name: 'Done', exact: true }).click();
	await expect(articles).toHaveCount(4);
});
