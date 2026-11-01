import { expect, type Locator } from '@playwright/test';

/** Each card branch retains its real name, destination and own visual evidence. */
export async function assertModuleCardPreview(component: Locator, variant: string) {
	await assertUsageImage(component, variant);
	if (['missing', 'page-missing', 'layout-missing'].includes(variant)) {
		await expect(component.getByText('No screenshot is recorded at this revision')).toBeVisible();
		await expect(component.locator('img')).toHaveCount(0);
	}
	if (variant === 'image-error') {
		await expect(component.getByText('Screenshot could not be loaded.')).toBeVisible();
		await expect(component.locator('img')).toHaveCount(0);
	}
	if (['function', 'unlinked'].includes(variant)) {
		await expect(component.locator('.ex-function-call')).toBeVisible();
		await expect(component.locator('img')).toHaveCount(0);
	}
	if (variant === 'unlinked') {
		await expect(component.locator('span.ex-function-call')).toHaveText('Orders styles');
		await expect(component.locator('a.ex-function-call')).toHaveCount(0);
	}
	const images: Record<string, [string, string]> = {
		page: ['a.ex-page-open img', '/media/synthetic-orders-page-input.svg'],
		layout: ['img', '/media/synthetic-layout-input.svg']
	};
	if (images[variant])
		await expect(component.locator(images[variant][0])).toHaveAttribute('src', images[variant][1]);
	if (variant === 'api') {
		await expect(component.locator('.ex-function-call')).toContainText(
			'GET POST DELETE /api/orders'
		);
		await expect(component.getByRole('group', { name: 'Used In' })).toContainText('OrderStore');
	}
	if (variant === 'api-no-methods')
		await expect(component.locator('.ex-function-call')).toHaveText('/api/orders');
	if (variant === 'no-usage')
		await expect(component.getByRole('group', { name: 'Used In' })).toContainText('—');
	if (variant === 'many-usage') {
		const usage = component.getByRole('group', { name: 'Used In' });
		await expect(usage.getByRole('link')).toHaveCount(3);
		await expect(usage.locator('.ex-usage-more')).toContainText('1 more usage');
		await expect(usage).not.toContainText('OrderCard');
	}
}

async function assertUsageImage(component: Locator, variant: string) {
	if (variant !== 'usage-open') return;
	const preview = component.getByRole('tooltip', { name: 'Preview of OrderList' });
	const image = preview.getByRole('img', { name: 'Screenshot of OrderList' });
	await expect(image).toHaveAttribute('src', /^data:image\/svg\+xml,/);
	expect(decodeURIComponent((await image.getAttribute('src'))!)).toContain('Order management');
}

/** Preview artwork contains product content; fixture provenance stays outside the painted image. */
export async function assertProductArtwork(component: Locator, id: string, variant: string) {
	const states: Record<string, string[]> = {
		'reports.component.explorer-catalog-items': [
			'',
			'multiple',
			'batched',
			'more',
			'all',
			'batch-focused',
			'batch-hovered',
			'functions',
			'pages',
			'configs',
			'configs-open',
			'empty-configs',
			'unlinked'
		],
		'reports.component.explorer-ui-explorer-module-card': [
			'',
			'many-usage',
			'no-usage',
			'page',
			'layout',
			'usage-open'
		],
		'reports.component.modal': ['image', 'lightbox'],
		'reports.component.explorer-usage': ['usage-open'],
		'reports.component.entity-states': ['', 'current', 'initial', 'viewer-open', 'viewport-mobile']
	};
	if (!states[id]?.includes(variant)) return;
	if (variant === 'usage-open') await assertUsagePreviewBounds(component);
	const forbidden = /\b(?:synthetic|fictional|fixtures?)\b/i;
	for (const image of await component.locator('img').all()) {
		if (!(await image.isVisible())) continue;
		const content = await image.evaluate(async (node: HTMLImageElement) => {
			const response = await fetch(node.currentSrc);
			return { ok: response.ok, text: await response.text() };
		});
		expect(content.ok, 'Painted preview artwork is readable').toBe(true);
		expect(content.text, 'Artwork omits painted fixture labels').not.toMatch(forbidden);
		expect(await image.getAttribute('alt')).not.toMatch(forbidden);
	}
	expect((await component.locator('figcaption').allTextContents()).join(' ')).not.toMatch(
		forbidden
	);
}

/** Fixed previews stay inside their owner horizontally and leave the module title clear. */
async function assertUsagePreviewBounds(component: Locator) {
	const preview = component.getByRole('tooltip');
	const popup = (await preview.boundingBox())!;
	const article = component.locator('article').first();
	const owner = (await ((await article.count()) ? article : component).boundingBox())!;
	expect(popup.x, 'Usage preview stays inside its owner left edge').toBeGreaterThanOrEqual(owner.x);
	expect(
		popup.x + popup.width,
		'Usage preview stays inside its owner right edge'
	).toBeLessThanOrEqual(owner.x + owner.width);
	if (await article.count()) {
		const title = (await article.getByRole('heading').boundingBox())!;
		const overlaps =
			popup.x < title.x + title.width &&
			popup.x + popup.width > title.x &&
			popup.y < title.y + title.height &&
			popup.y + popup.height > title.y;
		expect(overlaps, 'Usage preview leaves the module title visible').toBe(false);
	}
}
