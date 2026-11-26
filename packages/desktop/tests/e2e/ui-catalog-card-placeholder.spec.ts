import type { Shown } from './ui-catalog-card-placeholder.spec.types';
import { expect, test, type Page } from '../../../../test/support/browserTest';
import { listedProject, pictured } from './ui-catalog-listing-fixture';

/** A page of the listing that the session reports with no recorded screenshot. */
const bare = 'page.orders-error';
const cards = (page: Page) => page.locator('main.catalog article.entity-card');
const cardOf = (page: Page, id: string) =>
	cards(page).filter({ has: page.locator(`a[href$="/${id}"]`) });

/**
 * The bridge answers the listing as the session does, except that one page has no recorded
 * screenshot. The wrapper runs after the listing's own bridge is installed.
 */
async function withoutScreenshot(page: Page, id: string) {
	await page.addInitScript((target: string) => {
		const bridge = (window as unknown as { harness: Record<string, (...a: unknown[]) => unknown> })
			.harness;
		const drop = (shown: Shown) => ({
			...shown,
			entities: shown.entities.map((entity) =>
				entity.id === target ? { ...entity, thumbnail: undefined } : entity
			)
		});
		for (const name of ['openProject', 'snapshot']) {
			const call = bridge[name];
			bridge[name] = async (...args: unknown[]) => drop((await call(...args)) as Shown);
		}
	}, id);
}

test('a card without a screenshot is at most 260px tall at 1440', async ({ page }, info) => {
	await listedProject(page);
	await withoutScreenshot(page, bare);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/');
	await page.getByRole('button', { name: 'Open project', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Pages', exact: true, level: 1 })).toBeVisible();
	await expect(cards(page).first()).toBeVisible();
	const card = cardOf(page, bare);
	await expect(card).toHaveCount(1);
	await expect(card.getByText('No screenshot recorded', { exact: true })).toBeVisible();
	await expect(card.locator('img, hx-img, .thumbnail.runtime')).toHaveCount(0);
	await pictured(page, info, 'placeholder-pages');
	const box = await card.boundingBox();
	expect(box?.height ?? Infinity, 'a card without a screenshot').toBeLessThanOrEqual(260);
});
