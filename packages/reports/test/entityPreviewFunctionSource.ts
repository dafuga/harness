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
