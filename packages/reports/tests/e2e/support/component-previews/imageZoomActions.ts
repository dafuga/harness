import { expect, type Locator, type Page } from '@playwright/test';

/** Hold a real image request until the test page closes, preserving the loading state. */
export async function routeLoadingZoom(page: Page, id: string, variant: string) {
	if (id !== 'reports.component.image-zoom' || variant !== 'loading') return;
	await page.route('**/media/image-zoom-loading.svg', async () => {
		await new Promise<void>((resolve) => page.once('close', () => resolve()));
	});
}

/** Only these explicit image states intentionally lack decoded pixels. */
export async function previewImages(component: Locator, id: string, variant: string) {
	// EntitySections keeps a second gallery in its closed verification disclosure.
	if (id === 'reports.component.harness-entity-sections')
		return component.locator('img:visible').all();
	if (id === 'reports.component.shared-primitives-atoms-html-img' && variant === 'alt-only')
		return [];
	if (id === 'reports.component.image-zoom' && ['loading', 'error'].includes(variant)) return [];
	if (
		id === 'reports.component.gameplay-replay' &&
		['loading', 'image-error', 'skipped'].includes(variant)
	)
		return [];
	return component.locator('img').all();
}

/** Open the real controls and retain each requested interaction state for capture. */
export async function prepareImageZoom(component: Locator, variant: string) {
	const image = component.locator('.stage img');
	if (variant === 'loading' || variant === 'error') return await expectUnsettled(image, variant);
	const plus = component.getByRole('button', { name: 'Zoom in' });
	const minus = component.getByRole('button', { name: 'Zoom out' });
	if (!variant) await expect(minus).toHaveAttribute('aria-disabled', 'true');
	if (['actual', 'zoom-out', 'panned', 'focused', 'dragging'].includes(variant)) {
		await component.getByRole('button', { name: 'Actual size' }).click();
		await expect(component.locator('output')).toHaveText('100%');
	}
	if (variant === 'zoomed') {
		await component.getByRole('button', { name: 'Actual size' }).click();
		await plus.click();
		await plus.click();
		await expect(component.locator('output')).toHaveText('150%');
		await component.locator('.stage.zoomed').evaluate((node) => node.scrollTo(0, 0));
		await expect(minus).toHaveAttribute('aria-disabled', 'false');
	}
	if (variant === 'zoom-out') {
		await minus.click();
		await expect(component.locator('output')).not.toHaveText('100%');
	}
	if (variant === 'maximum') await zoomToMaximum(component, plus);
	if (variant === 'focused') {
		const stage = component.locator('.stage.zoomed');
		await component.page().keyboard.press('Tab');
		await component.page().keyboard.press('Tab');
		await expect(stage).toBeFocused();
		await expect.poll(() => stage.evaluate((node) => node.matches(':focus-visible'))).toBe(true);
	}
	if (['panned', 'dragging'].includes(variant)) await panZoom(component, plus, variant);
}

async function expectUnsettled(image: Locator, variant: string) {
	await expect
		.poll(() =>
			image.evaluate(
				(node: HTMLImageElement, state) =>
					state === 'loading' ? !node.complete : node.complete && node.naturalWidth === 0,
				variant
			)
		)
		.toBe(true);
}

async function zoomToMaximum(component: Locator, plus: Locator) {
	for (let step = 0; step < 12; step++) {
		if ((await plus.getAttribute('aria-disabled')) === 'true') break;
		await plus.click();
	}
	await expect(plus).toHaveAttribute('aria-disabled', 'true');
	await expect(component.locator('output')).toHaveText('400%');
	// At maximum zoom, start at the image's header instead of an empty center region.
	await component.locator('.stage.zoomed').evaluate((node) => node.scrollTo(0, 0));
}

async function panZoom(component: Locator, plus: Locator, variant: string) {
	await plus.click();
	await plus.click();
	await expect(component.locator('output')).toHaveText('150%');
	const stage = component.locator('.stage.zoomed');
	await stage.scrollIntoViewIfNeeded();
	const box = (await stage.boundingBox())!;
	const page = component.page();
	const idleBorder = await stage.evaluate((node) => getComputedStyle(node).borderTopColor);
	await page.mouse.move(box.x + Math.min(80, box.width / 2), box.y + Math.min(120, box.height / 2));
	await page.mouse.down();
	await page.mouse.move(box.x + Math.min(80, box.width / 2), box.y + Math.min(60, box.height / 3));
	await expect.poll(() => stage.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
	if (variant === 'dragging') await expectVisibleDrag(stage, idleBorder);
	else await page.mouse.up();
}

/** A drag must be visible in a still image, where the grabbing cursor is not captured. */
async function expectVisibleDrag(stage: Locator, idleBorder: string) {
	await expect(stage).toHaveClass(/dragging/);
	await expect
		.poll(() => stage.evaluate((node) => getComputedStyle(node).borderTopColor))
		.not.toBe(idleBorder);
}
