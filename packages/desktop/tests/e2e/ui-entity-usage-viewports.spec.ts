import { expect, test, type Page } from '../../../../test/support/browserTest';
import { pictured, related } from './ui-entity-usage-fixture';
import { branch, evidenceFixture, ids, sharedProject } from './ui-evidence-fixture';

/**
 * Used In and Uses of the workspace at the widths of a tablet and a phone: both sections stay
 * on the overview, each keeps its names and badges, and nothing runs out of the page sideways.
 */
const root = `/projects/${sharedProject}/harness/branch/${encodeURIComponent(branch)}`;
const panel = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
const widths = [
	{ id: 'tablet', width: 920, height: 1100 },
	{ id: 'mobile', width: 390, height: 844 }
] as const;

for (const viewport of widths)
	test(`the overview holds Used In and Uses at ${viewport.id} width`, async ({ page }, info) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await evidenceFixture(page);
		await page.goto(`${root}/pages/${ids.page}`);
		await expect(page.getByRole('heading', { level: 1, name: 'Orders page' })).toBeVisible();
		await related(page);
		await page.evaluate((to) => {
			history.pushState({}, '', to);
			dispatchEvent(new PopStateEvent('popstate'));
		}, `${root}/functions/${ids.filter}`);
		await expect(page.getByRole('heading', { level: 1, name: 'filterOrders' })).toBeVisible();
		await pictured(page, info, `workspace-overview-${viewport.id}`);
		await expect(panel(page, 'Used In').getByRole('link')).toHaveText(['Orders page', 'OrderList']);
		await expect(panel(page, 'Used In')).toContainText(/OrderList\s*Component/);
		await expect(panel(page, 'Uses').getByRole('link')).toHaveText(['orderSettings', 'OrderStore']);
		await expect(page.getByText(/relationship|used by/i)).toHaveCount(0);
		// On a phone the section tabs are one scrolling row. The Conversation icon button has no text.
		const lines = await page
			.getByRole('navigation', { name: 'Entity sections' })
			.getByRole('button')
			.filter({ hasText: /\S/ })
			.evaluateAll(
				(buttons) => new Set(buttons.map((b) => Math.round(b.getBoundingClientRect().top))).size
			);
		// One row is the phone rule (at most 560px); a tablet keeps its wrapping tabs.
		if (viewport.id === 'mobile') expect(lines).toBe(1);
		const sideways = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
		expect(sideways).toBeLessThanOrEqual(0);
	});
