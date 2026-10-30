import { expect, type Locator } from '@playwright/test';
import { previewCaptureBounds } from './previewCaptureBounds';

/** Use the link's own focus and touch handling to reach its preview states. */
export async function prepareUsageLink(component: Locator, variant: string) {
	if (variant === 'touch') {
		await component.getByRole('link').dispatchEvent('pointerenter', { pointerType: 'touch' });
		await expect(component.getByRole('tooltip')).toHaveCount(0);
	}
	if (!variant.endsWith('-open')) return;
	await component.getByRole('link').focus();
	await expect(component.getByRole('tooltip')).toBeVisible();
}

/** Verify the real preview, its image readiness, and that capture bounds contain the tooltip. */
export async function assertUsageLink(component: Locator, variant: string) {
	if (variant.startsWith('source-')) {
		const source = component.getByRole('button', { name: 'renderOrderRow' });
		if (variant === 'source-enabled') await expect(source).toBeEnabled();
		else await expect(source).toBeDisabled();
	}
	if (!variant.endsWith('-open')) return;
	const tip = component.getByRole('tooltip');
	if (variant === 'function-open') await expect(tip.locator('code')).toHaveText('filterOrders');
	if (variant === 'missing-open') await expect(tip).toContainText('No screenshot is recorded');
	if (variant === 'visual-open') {
		const image = tip.getByRole('img', { name: 'Screenshot of OrderList' });
		await expect
			.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth))
			.toBeGreaterThan(0);
		await image.evaluate((node: HTMLImageElement) => node.decode());
		await expect(tip).toContainText(/Fresh capture at|Reused from/);
	}
	const box = await tip.boundingBox();
	const clip = await previewCaptureBounds(
		component.page(),
		'reports.component.explorer-usage-link',
		variant
	);
	const offset = await component.page().evaluate(() => ({ x: scrollX, y: scrollY }));
	expect(box).not.toBeNull();
	expect(clip.x).toBeLessThanOrEqual(box!.x + offset.x);
	expect(clip.y).toBeLessThanOrEqual(box!.y + offset.y);
	expect(clip.x + clip.width).toBeGreaterThanOrEqual(box!.x + offset.x + box!.width);
	expect(clip.y + clip.height).toBeGreaterThanOrEqual(box!.y + offset.y + box!.height);
}
