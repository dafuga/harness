import { expect, type Locator } from '@playwright/test';

/** Exercise gallery filters and viewers through their real controls. */
export async function prepareEvidenceGrid(component: Locator, variant: string) {
	if (variant === 'no-items') {
		await expect(component.getByText('No matching evidence.', { exact: true })).toBeVisible();
		await expect(component.locator('.evidence-grid .evidence-card')).toHaveCount(0);
	}
	if (variant === 'screenshot-only') await expect(component.locator('.media-tabs')).toHaveCount(0);
	if (['empty', 'search'].includes(variant)) {
		const value = variant === 'empty' ? 'no-match' : 'mobile';
		await component
			.getByRole('textbox', { name: 'Search screenshots, audio and transcripts' })
			.fill(value);
		if (variant === 'empty')
			await expect(component.getByText('No matching evidence.', { exact: true })).toBeVisible();
		else await expect(component.locator('.evidence-grid .evidence-card')).toHaveCount(1);
	}
	if (['audio', 'screenshots'].includes(variant)) {
		const button = component.locator('.media-tabs').getByRole('button', {
			name: variant === 'audio' ? /^Audio/ : /^Screenshots/
		});
		await button.click();
		await expect(button).toHaveAttribute('aria-pressed', 'true');
	}
	if (variant.startsWith('viewport-')) await selectViewport(component, variant.slice(9));
	if (variant === 'category') {
		const button = component
			.getByRole('group', { name: 'Evidence filters' })
			.getByRole('button', { name: 'Checkout', exact: true });
		await button.click();
		await expect(button).toHaveAttribute('aria-pressed', 'true');
	}
	if (['status', 'status-open'].includes(variant)) await selectStatus(component, variant);
	if (variant.startsWith('upload-')) await openUpload(component, variant);
	if (variant === 'uploads') await expect(component.locator('.upload-comparison')).toHaveCount(2);
	if (variant === 'image-open') await openImage(component);
	if (variant === 'audio-open') {
		await component
			.getByRole('button', { name: 'Open audio comparison: Release narration' })
			.click();
		await expect(component.getByRole('dialog')).toBeVisible();
	}
}

async function selectViewport(component: Locator, size: string) {
	const button = component.getByRole('button', {
		name: `${size[0].toUpperCase()}${size.slice(1)} screenshots`,
		exact: true
	});
	await button.click();
	await expect(button).toHaveAttribute('aria-pressed', 'true');
	await expect(component.locator('.evidence-grid .evidence-card')).toHaveCount(1);
}

async function selectStatus(component: Locator, variant: string) {
	const select = component.getByRole('combobox', { name: 'Status' });
	if (variant === 'status') {
		await select.selectOption('passed');
		await expect(select).toHaveValue('passed');
	} else {
		await component
			.getByRole('textbox', { name: 'Search screenshots, audio and transcripts' })
			.fill('refund');
		await expect(component.getByText('No matching evidence.', { exact: true })).toBeVisible();
		await select.click();
		await expect.poll(() => select.evaluate((node) => node.matches(':open'))).toBe(true);
	}
}

async function openUpload(component: Locator, variant: string) {
	const detail = component.locator(
		variant === 'upload-audio-open' ? '.upload-audio' : '.upload-comparison:not(.upload-audio)'
	);
	await detail.locator('summary').click();
	await expect(detail).toHaveAttribute('open', '');
}

async function openImage(component: Locator) {
	await component.getByRole('button', { name: 'Open Checkout confirmation', exact: true }).click();
	const dialog = component.getByRole('dialog');
	await expect(dialog).toBeVisible();
	const image = dialog.locator('img').first();
	await expect
		.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0))
		.toBe(true);
	await image.evaluate((node: HTMLImageElement) => node.decode());
	const caption = dialog.locator('figcaption').first();
	await expect(caption).toBeVisible();
	const captionBox = await caption.boundingBox();
	const dialogBox = await dialog.boundingBox();
	expect(captionBox!.y + captionBox!.height).toBeLessThanOrEqual(dialogBox!.y + dialogBox!.height);
}
