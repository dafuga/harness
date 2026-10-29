import { expect, type Locator } from '../../../../../../test/support/browserTest';

/** Layout previews show both their child slot and the catalog's own layout screenshot. */
export async function assertCatalogLayout(
	component: Locator,
	unit: { id: string; kind: string },
	viewport: { width: number; height: number }
) {
	if (unit.kind === 'layout') {
		const slot = component.getByRole('region', { name: 'Child content', exact: true });
		await expect(slot).toBeVisible();
		const box = await slot.boundingBox();
		expect(box!.width).toBeGreaterThan(200);
		expect(box!.height).toBeGreaterThan(250);
		await expect(slot).toContainText('Your page renders here');
		const bubble = component.locator('.floating-chat-bubble');
		await expect(bubble, 'The complete layout includes exactly one chat bubble').toHaveCount(1);
		await expect(bubble).toBeVisible();
		const bubbleBox = await bubble.boundingBox();
		expect(bubbleBox!.x).toBeGreaterThanOrEqual(0);
		expect(bubbleBox!.y + bubbleBox!.height).toBeLessThanOrEqual(viewport.height);
		expect(bubbleBox!.x + bubbleBox!.width).toBeLessThanOrEqual(viewport.width);
	}
	if (unit.id === 'reports.page.harness-branch-branch-at-layouts') {
		const card = component.locator('article').filter({ hasText: 'OrdersFrame' });
		await expect(card.locator('img')).toHaveAttribute('src', /synthetic-layout-input\.svg$/);
		const usage = card.getByRole('link', { name: 'Orders page', exact: true });
		await expect(usage).toBeVisible();
		await expect(usage).toHaveAttribute('href', /\/pages\/app\.page\.orders$/);
	}
}

/** Report examples retain their named values and consumers in each catalog capture. */
export async function assertReportExamples(component: Locator, id: string) {
	if (id === 'reports.component.explorer-function-card') {
		await expect(component.locator('article')).toHaveCSS('border-top-style', 'solid');
		await expect(component.locator('code')).toHaveText('filterOrders(orders, "SERVICE")');
		await expect(component.getByRole('link', { name: 'OrderList', exact: true })).toBeVisible();
		await expect(component.getByRole('link', { name: 'OrderStore', exact: true })).toBeVisible();
	}
	if (id === 'reports.component.usage-examples-usage-examples')
		await expect(component.locator('code')).toHaveText('formatDuration(90)\n// => "1:30"');
	if (id === 'reports.component.harness-entity-history-row') {
		await expect(component.locator('table.ex-history tbody > tr')).toHaveCount(1);
		await expect(component.locator('td').first()).toHaveCSS('white-space', 'nowrap');
	}
}
