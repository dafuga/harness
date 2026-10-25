import { expect, type Page } from '@playwright/test';
import { open, capture, ready } from './entityPreviewPage';
import { apiIds } from './entityApiFixtures';
const profileUnit = 'reports.component.networking-security-explorer-permissions-screen';
/** Every permission view uses the normal host, real tab routing and the same synthetic policy. */
export async function reviewPermissionProfiles(page: Page, viewport: string): Promise<void> {
	const tab = page.getByRole('tab', { name: 'Permissions', exact: true });
	if (await tab.count()) await tab.click();
	await page.reload();
	await capture(page, `api-permissions-${viewport}`, [
		'reports.component.harness-entity-header',
		'reports.component.harness-entity-sections'
	]);
	await expect(tab).toBeVisible();
	await expect(page.getByRole('tabpanel')).toContainText('Own account only');
	await expect(page.getByRole('tabpanel')).toContainText('Administrator');
	await page.locator('a[href$="/permissions/member"]').first().click();
	await expect(page.getByRole('heading', { level: 1, name: 'Member', exact: true })).toBeVisible();
	await page.locator('a[href$="/permissions"]').first().click();
	await expect(
		page.getByRole('heading', { level: 1, name: 'Users & Permissions', exact: true })
	).toBeVisible();
	await page.reload();
	await ready(page);
	await capture(page, `permission-profiles-${viewport}`, [profileUnit]);
	for (const [id, title, scope] of [
		['guest', 'Guest', ''],
		['member', 'Member', 'Own account only'],
		['admin', 'Administrator', 'All accounts']
	]) {
		await page.locator(`a[href$="/permissions/${id}"]`).first().click();
		await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
		await page.reload();
		await ready(page);
		await capture(page, `permission-profile-${id}-${viewport}`, [profileUnit]);
		if (scope) await expect(page.locator('.ex-content')).toContainText(scope);
		if (id === 'member')
			await expect(page.locator('.ex-content')).not.toContainText('All accounts');
		await page.locator('a[href$="/permissions"]').first().click();
	}
	await open(page, { category: 'apis', entity: apiIds.orders }, 'apis');
	await ready(page);
}
