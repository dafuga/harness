import { expect, type Locator } from '@playwright/test';
import { previewCaptureBounds } from './previewCaptureBounds';

/** Open a real Used In preview and include its visible image in the component capture. */
export async function prepareUsagePopover(component: Locator, variant: string) {
	if (variant !== 'usage-open') return;
	const link = component.getByRole('group', { name: 'Used In' }).getByRole('link').first();
	await expect(link).toHaveText('OrderList');
	await link.focus();
	const tip = component.getByRole('tooltip');
	await expect(tip).toBeVisible();
	const image = tip.locator('img');
	await expect
		.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth))
		.toBeGreaterThan(0);
	await image.evaluate((node: HTMLImageElement) => node.decode());
	expect(decodeURIComponent((await image.getAttribute('src'))!)).toContain('SYNTHETIC ORDER LIST');
	const id = (await component.getAttribute('data-preview-unit'))!;
	const clip = await previewCaptureBounds(component.page(), id, variant);
	const box = (await tip.boundingBox())!;
	const offset = await component.page().evaluate(() => ({ x: scrollX, y: scrollY }));
	expect(clip.x).toBeLessThanOrEqual(box.x + offset.x);
	expect(clip.y).toBeLessThanOrEqual(box.y + offset.y);
	expect(clip.x + clip.width).toBeGreaterThanOrEqual(box.x + offset.x + box.width);
	expect(clip.y + clip.height).toBeGreaterThanOrEqual(box.y + offset.y + box.height);
}

/** Use the link's own focus and touch handling to reach its preview states. */
export async function prepareUsageLink(component: Locator, variant: string) {
	if (variant === 'touch') {
		await component.getByRole('link').dispatchEvent('pointerenter', { pointerType: 'touch' });
		await expect(component.getByRole('tooltip')).toHaveCount(0);
	}
	if (!variant.endsWith('-open')) return;
	const link = component.getByRole('link');
	if (variant === 'hover-open') await link.hover();
	else await link.focus();
	await expect(component.getByRole('tooltip')).toBeVisible();
}

/** Verify the real preview, its image readiness, and that capture bounds contain the tooltip. */
export async function assertUsageLink(component: Locator, variant: string) {
	if (variant.startsWith('source-')) {
		const source = component.getByRole('button', { name: 'renderOrderRow' });
		if (variant === 'source-enabled') {
			await expect(source).toBeEnabled();
			await expect(source).toHaveCSS('opacity', '1');
		} else {
			await expect(source).toBeDisabled();
			await expect(source, 'Disabled source links are visibly dimmed').toHaveCSS('opacity', '0.45');
		}
	}
	if (!variant.endsWith('-open')) return;
	const tip = component.getByRole('tooltip');
	if (variant === 'function-open') await expect(tip.locator('code')).toHaveText('filterOrders');
	if (variant === 'missing-open') await expect(tip).toContainText('No screenshot is recorded');
	if (variant === 'image-error-open')
		await expect(tip).toContainText('Screenshot could not be loaded.');
	await assertUsageLinkImage(tip, variant);
	await assertUsageLinkBounds(component, tip, variant);
}

async function assertUsageLinkImage(tip: Locator, variant: string) {
	if (['visual-open', 'hover-open', 'inherited-open'].includes(variant)) {
		const image = tip.getByRole('img', { name: 'Screenshot of OrderList' });
		await expect
			.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth))
			.toBeGreaterThan(0);
		await image.evaluate((node: HTMLImageElement) => node.decode());
		await expect(tip).toContainText(
			variant === 'inherited-open' ? 'Reused from 3f9c2a1' : 'Fresh capture at 8b41d07'
		);
	}
}

async function assertUsageLinkBounds(component: Locator, tip: Locator, variant: string) {
	const box = await tip.boundingBox();
	const trigger = await component.getByRole('link').boundingBox();
	expect(trigger).not.toBeNull();
	expect(box).not.toBeNull();
	expect(box!.x, 'Usage preview overlaps its trigger horizontally').toBeLessThanOrEqual(
		trigger!.x + trigger!.width
	);
	expect(box!.x + box!.width).toBeGreaterThanOrEqual(trigger!.x);
	const clip = await previewCaptureBounds(
		component.page(),
		'reports.component.explorer-usage-link',
		variant
	);
	const offset = await component.page().evaluate(() => ({ x: scrollX, y: scrollY }));
	expect(clip.x).toBeLessThanOrEqual(box!.x + offset.x);
	expect(clip.y).toBeLessThanOrEqual(box!.y + offset.y);
	expect(clip.x + clip.width).toBeGreaterThanOrEqual(box!.x + offset.x + box!.width);
	expect(clip.y + clip.height).toBeGreaterThanOrEqual(box!.y + offset.y + box!.height);
}
