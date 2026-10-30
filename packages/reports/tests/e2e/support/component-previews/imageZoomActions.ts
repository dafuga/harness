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
	if (id === 'reports.component.image-zoom' && ['loading', 'error'].includes(variant)) return [];
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
		await plus.click();
		await expect(minus).toHaveAttribute('aria-disabled', 'false');
	}
	if (variant === 'zoom-out') {
		await minus.click();
		await expect(component.locator('output')).not.toHaveText('100%');
	}
	if (variant === 'maximum') await zoomToMaximum(component, plus);
	if (variant === 'focused') {
		const stage = component.locator('.stage.zoomed');
		await stage.focus();
		await expect(stage).toBeFocused();
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
}

async function panZoom(component: Locator, plus: Locator, variant: string) {
	await plus.click();
	await plus.click();
	await expect(component.locator('output')).toHaveText('150%');
	const stage = component.locator('.stage.zoomed');
	await stage.scrollIntoViewIfNeeded();
	const box = (await stage.boundingBox())!;
	const page = component.page();
	await page.mouse.move(box.x + Math.min(80, box.width / 2), box.y + Math.min(120, box.height / 2));
	await page.mouse.down();
	await page.mouse.move(box.x + Math.min(80, box.width / 2), box.y + Math.min(60, box.height / 3));
	await expect.poll(() => stage.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
	if (variant === 'dragging') await expect(stage).toHaveClass(/dragging/);
	else await page.mouse.up();
}
