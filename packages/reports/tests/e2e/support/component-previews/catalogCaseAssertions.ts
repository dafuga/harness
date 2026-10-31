import { expect, type Locator } from '../../../../../../test/support/browserTest';
import { assertRecordedReportPreviewState } from './reportPreviewAssertions';

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

/** Catalog examples retain their named values, consumers and basic presentation. */
export async function assertCatalogDetails(component: Locator, id: string, variant = '') {
	await assertRecordedReportPreviewState(component, id, variant);
	if (id === 'reports.component.harness-explorer-index') {
		await expect(
			component.getByText('Hover, focus or tap a mark to read why.', { exact: true }),
			'Catalogs omit the proof legend'
		).toHaveCount(0);
		await expect(
			component.getByRole('button', { name: /^(?:Not proven|Proven)$/ }),
			'Catalogs omit the standalone proof marks'
		).toHaveCount(0);
	}
	if (id === 'reports.component.explorer-function-card' && !variant) {
		await expect(component.locator('article')).toHaveCSS('border-top-style', 'solid');
		await expect(component.locator('code')).toHaveText('filterOrders(orders, "SERVICE")');
		await expect(component.getByRole('link', { name: 'OrderList', exact: true })).toBeVisible();
		await expect(component.getByRole('link', { name: 'OrderStore', exact: true })).toBeVisible();
	}
	if (id === 'reports.component.usage-examples-usage-examples' && !variant)
		await expect(component.locator('code')).toHaveText('formatDuration(90)\n// => "1:30"');
	if (id === 'reports.component.harness-entity-history-row') {
		await expect(component.locator('table.ex-history tbody > tr')).toHaveCount(1);
		await expect(component.locator('td').first()).toHaveCSS('white-space', 'nowrap');
	}
	if (id === 'reports.component.harness-harness-icon') {
		await expect(component.locator('svg')).toBeVisible();
		await expect(component.locator('path')).toHaveAttribute('d', /\S+/);
	}
	if (id === 'hub.component.account-menu') {
		await expect(component).toHaveCSS('display', 'flex');
		await expect(component).toHaveCSS('column-gap', '10px');
	}
}
