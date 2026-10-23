import type { Page } from '@playwright/test';
import { expect } from '../../../test/support/browserTest';
import { capture, fits, open, where } from './entityPreviewPage';
import { commits, ids } from './entityUnits';

/** Source navigation stays bound to the selected repository and full commit. */
export async function reviewHelperSource(page: Page, viewport: string): Promise<void> {
	const filter = { category: 'functions' as const, entity: ids.filter };
	for (const commit of [null, commits.middle]) {
		await open(page, { ...filter, commit });
		await expect(page.getByRole('link', { name: 'Details', exact: true })).toHaveCount(0);
		await page.getByRole('tab', { name: 'Source', exact: true }).click();
		await capture(page, `github-source-${commit ? 'commit' : 'tip'}-${viewport}`);
		const file = 'src/functions/filterOrders.ts';
		await expect(
			page.getByRole('link', { name: file, exact: true }),
			'GitHub source links'
		).toHaveAttribute(
			'href',
			`https://github.com/example/orders/blob/${commit ?? commits.tip}/${file}`
		);
		await expect(page.getByText(/Source ownership|Execution targets|Identity /)).toHaveCount(0);
		expect(await fits(page)).toBe(true);
		await page.getByRole('tab', { name: 'Overview', exact: true }).click();
		expect(await where(page)).toEqual({ branch: 'feature/orders', commit, ...filter });
	}
}

/** Private named callers retain callable and revision identity without entering the collection. */
export async function reviewNamedCallers(page: Page, viewport: string): Promise<void> {
	const units = [
		'reports.component.explorer-usage',
		'reports.component.explorer-usage-link',
		'reports.component.harness-explorer-catalog-screen'
	];
	for (const variant of ['named-callers', 'sibling-callers'] as const) {
		for (const commit of [null, commits.middle]) {
			await open(page, { category: 'functions', commit }, variant);
			const cards = page.getByRole('article');
			await expect(cards, 'Private callers never become public helper cards').toHaveCount(1);
			const usage = cards.getByRole('group', { name: 'Used In', exact: true });
			await expect(usage.getByRole('link')).toHaveText(['firstCall', 'secondCall', 'thirdCall']);
			await expect(usage).toContainText('…');
			await expect(usage).not.toContainText('fourthCall');
			await capture(page, `${variant}-${commit ? 'commit' : 'tip'}-${viewport}`, units);
			await usage.getByRole('link', { name: 'firstCall', exact: true }).press('Enter');
			expect(await where(page)).toMatchObject({
				branch: 'feature/orders',
				commit,
				category: 'functions',
				helper: 'firstCall',
				entity: variant === 'sibling-callers' ? ids.filter : 'function.named-users'
			});
			await expect(page.getByRole('heading', { name: 'firstCall', exact: true })).toBeVisible();
			await page.getByRole('tab', { name: 'Source', exact: true }).click();
			await expect(page.getByRole('tabpanel', { name: 'firstCall source' })).toBeVisible();
			await capture(page, `${variant}-source-${commit ? 'commit' : 'tip'}-${viewport}`, units);
			expect(await fits(page)).toBe(true);
		}
	}
}
