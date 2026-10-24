import { expect, type Page } from '@playwright/test';
import { open, capture, fits, ready } from './entityPreviewPage';
import { commits, ids } from './entityUnits';
import { apiIds } from './entityApiFixtures';

/** The normal host over revision-specific endpoints and a page/service/HTTP dependency chain. */
export async function reviewApis(page: Page, viewport: string): Promise<void> {
	await open(page, { category: 'pages', entity: ids.page }, 'apis');
	await ready(page);
	await capture(page, `api-entry-${viewport}`, ['reports.component.harness-harness-navbar']);
	await expect(page.getByRole('link', { name: 'APIs', exact: true })).toHaveCount(1);
	await page.getByRole('link', { name: 'APIs', exact: true }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'APIs', exact: true })).toBeVisible();
	await expect(page.getByRole('status').filter({ hasText: '3 of 3 apis shown' })).toBeVisible();
	await capture(page, `api-catalog-${viewport}`, [
		'reports.component.harness-explorer-catalog-screen',
		'reports.component.harness-explorer-index',
		'reports.component.explorer-ui-explorer-module-card',
		'reports.component.harness-explorer-content',
		'reports.component.harness-harness-navbar'
	]);
	const orders = page.getByRole('article', { name: '/api/orders', exact: true });
	await expect(orders).toContainText('GET');
	await expect(orders).toContainText('POST');
	await orders.getByRole('link', { name: '/api/orders', exact: true }).click();
	await expect(
		page.getByRole('heading', { level: 1, name: '/api/orders', exact: true })
	).toBeVisible();
	await expect(page.getByRole('tabpanel')).toContainText('RequestEvent');
	await capture(page, `api-contract-${viewport}`, [
		'reports.component.entity-contract',
		'reports.component.harness-entity-header'
	]);
	await page.getByRole('tab', { name: 'Used In', exact: true }).click();
	await page.getByRole('link', { name: 'Orders page', exact: true }).first().click();
	await page.getByRole('tab', { name: 'APIs', exact: true }).click();
	await expect(page.getByRole('tabpanel', { name: 'Orders page apis', exact: true })).toBeVisible();
	await expect(page.getByRole('article', { name: '/api/orders', exact: true })).toBeVisible();
	await expect(page.getByRole('article', { name: '/api/refunds', exact: true })).toBeVisible();
	await expect(page.getByRole('article', { name: '/api/status', exact: true })).toHaveCount(0);
	await capture(page, `page-apis-${viewport}`, [
		'reports.component.harness-entity-sections',
		'reports.component.harness-entity-relations',
		'reports.component.harness-entity-header'
	]);
	await reviewHistoricalApis(page, viewport);
}

async function reviewHistoricalApis(page: Page, viewport: string): Promise<void> {
	await page.reload();
	await expect(page.getByRole('tabpanel', { name: 'Orders page apis', exact: true })).toBeVisible();
	await page.getByRole('combobox', { name: 'Commit', exact: true }).selectOption(commits.middle);
	await expect(page.getByRole('article', { name: '/api/orders', exact: true })).toBeVisible();
	await expect(page.getByRole('article', { name: '/api/refunds', exact: true })).toHaveCount(0);
	await page
		.getByRole('article', { name: '/api/orders', exact: true })
		.getByRole('link', { name: '/api/orders', exact: true })
		.click();
	expect(new URL(page.url()).pathname).toContain(`/commit/${commits.middle}/apis/${apiIds.orders}`);
	await expect(page.getByRole('tabpanel')).not.toContainText('POST');
	await page.getByRole('link', { name: 'Pages', exact: true }).first().click();
	await page
		.getByRole('article', { name: 'Orders page', exact: true })
		.getByRole('link', { name: 'Orders page', exact: true })
		.click();
	await page.getByRole('tab', { name: 'APIs', exact: true }).click();
	await page.getByRole('combobox', { name: 'Commit', exact: true }).selectOption(commits.first);
	await expect(page.getByRole('tabpanel')).toContainText('No APIs are recorded for this page.');
	await capture(page, `page-apis-empty-${viewport}`, [
		'reports.component.harness-entity-sections',
		'reports.component.harness-entity-relations'
	]);
	expect(await fits(page)).toBe(true);
}
