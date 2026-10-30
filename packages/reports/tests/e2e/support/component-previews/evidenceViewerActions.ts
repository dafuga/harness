import { expect, type Locator } from '@playwright/test';

/** Exercise the viewer's own controls and retain the selected state for capture. */
export async function prepareEvidenceViewer(component: Locator, variant: string) {
	const dialog = component.getByRole('dialog');
	await expect(dialog).toBeVisible();
	if (variant === 'before')
		await dialog.getByRole('button', { name: 'View before screenshot' }).click();
	if (variant === 'compare')
		await dialog.getByRole('button', { name: 'Compare before and after' }).click();
	if (variant === 'viewport-mobile')
		await dialog.getByRole('button', { name: 'View mobile screenshots' }).click();
	if (variant === 'viewport-tablet')
		await dialog.getByRole('button', { name: 'View tablet screenshots' }).click();
	if (variant === 'next') await dialog.getByRole('button', { name: 'Next image' }).click();
	if (variant === 'previous') await dialog.getByRole('button', { name: 'Previous image' }).click();
	if (variant === 'zoomed') await dialog.getByRole('button', { name: 'Zoom in' }).click();
	if (variant === 'actual-size') await dialog.getByRole('button', { name: 'Actual size' }).click();
	if (variant === 'no-navigation') await dialog.getByRole('button', { name: 'Next image' }).click();
	await assertViewerState(dialog, variant);
	for (const image of await dialog.locator('.viewer-images img').all()) {
		await expect
			.poll(() =>
				image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)
			)
			.toBe(true);
		await image.evaluate((node: HTMLImageElement) => node.decode());
	}
	await assertViewerImagesFit(dialog, variant);
}

/** Capture every image, its zoom controls, original link and caption inside the lightbox. */
async function assertViewerImagesFit(dialog: Locator, variant: string) {
	const figures = dialog.locator('.viewer-images figure');
	await expect(figures).toHaveCount(variant === 'compare' ? 2 : 1);
	for (const figure of await figures.all()) {
		await expect(figure.locator('figcaption')).toBeInViewport({ ratio: 1 });
		if (await figure.locator('.zoom').count()) {
			await expect(figure.locator('.zoom')).toBeInViewport({ ratio: 1 });
			await expect(figure.locator('a')).toBeInViewport({ ratio: 1 });
		}
	}
}

async function assertViewerState(dialog: Locator, variant: string) {
	if (variant === 'compare') await expect(dialog.locator('.viewer-images figure')).toHaveCount(2);
	if (variant === 'before')
		await expect(dialog.getByRole('heading', { name: 'Checkout before release' })).toBeVisible();
	if (variant === 'unavailable')
		await expect(dialog.getByText('The recorded screenshot could not be restored.')).toBeVisible();
	if (variant === 'no-pair')
		await expect(dialog.getByRole('button', { name: 'View mobile screenshots' })).toBeDisabled();
	if (variant === 'no-provenance')
		await expect(dialog.locator('.viewer-provenance')).toHaveCount(0);
	if (['viewport-mobile', 'next'].includes(variant))
		await expect(dialog.getByRole('heading', { name: 'Checkout on mobile' })).toBeVisible();
	if (['viewport-tablet', 'previous'].includes(variant))
		await expect(dialog.getByRole('heading', { name: 'Checkout on tablet' })).toBeVisible();
	if (variant === 'no-navigation')
		await expect(dialog.getByRole('heading', { name: 'Checkout after release' })).toBeVisible();
	if (variant === 'zoomed')
		await expect(dialog.getByRole('button', { name: 'Zoom out' })).toHaveAttribute(
			'aria-disabled',
			'false'
		);
	if (variant === 'actual-size') await expect(dialog.locator('output')).toHaveText('100%');
}
