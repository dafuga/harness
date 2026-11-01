import { expect, type Locator } from '@playwright/test';

/** Exercise gallery filters and viewers through their real controls. */
export async function prepareEvidenceGrid(component: Locator, variant: string) {
	await expect(component.getByText('No screenshot selected.', { exact: true })).toHaveCount(0);
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
	if (variant === 'category' || variant === 'category-audio') {
		const button = component.getByRole('group', { name: 'Evidence filters' }).getByRole('button', {
			name: variant === 'category' ? 'Checkout' : 'Voice review',
			exact: true
		});
		await button.click();
		await expect(button).toHaveAttribute('aria-pressed', 'true');
	}
	if (variant === 'status' || variant.startsWith('status-')) await selectStatus(component, variant);
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
	if (variant === 'status-open') {
		// Open over the real cards: the menu must not need a search to explain what it filters.
		await expect(component.locator('.evidence-grid .evidence-card')).toHaveCount(4);
		await expect(
			component.getByRole('textbox', { name: 'Search screenshots, audio and transcripts' })
		).toHaveValue('');
		await makeRoomBelow(select);
		await select.click();
		await expect.poll(() => select.evaluate((node) => node.matches(':open'))).toBe(true);
	} else {
		const status = variant === 'status' ? 'passed' : variant.slice('status-'.length);
		await select.selectOption(status);
		await expect(select).toHaveValue(status);
		if (status !== 'passed')
			await expect(component.locator('.evidence-grid .evidence-card')).toHaveCount(1);
	}
}

async function openImage(component: Locator) {
	const button = component.getByRole('button', { name: 'Open Checkout confirmation', exact: true });
	await button.click();
	const dialog = component.getByRole('dialog');
	await expect(dialog).toBeVisible();
	await dialog.getByRole('button', { name: 'Close viewer' }).click();
	await expect(dialog).toHaveCount(0);
	await expect(component.getByText('No screenshot selected.', { exact: true })).toHaveCount(0);
	await button.click();
	await expect(dialog).toBeVisible();
	const image = dialog.locator('img').first();
	await expect
		.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0))
		.toBe(true);
	await image.evaluate((node: HTMLImageElement) => node.decode());
	await expect(dialog.locator('output')).toHaveText(/^\d+%$/);
	const caption = dialog.locator('figcaption').first();
	await expect(caption).toBeVisible();
	const captionBox = await caption.boundingBox();
	const dialogBox = await dialog.boundingBox();
	expect(captionBox!.y + captionBox!.height).toBeLessThanOrEqual(dialogBox!.y + dialogBox!.height);
}

/** A native menu opens upward over the filters when the viewport ends too soon below its select. */
async function makeRoomBelow(select: Locator) {
	const page = select.page();
	const size = page.viewportSize();
	const box = await select.boundingBox();
	if (!size || !box) return;
	const needed = Math.ceil(box.y + box.height + MENU_ROOM);
	if (needed > size.height) await page.setViewportSize({ ...size, height: needed });
}

// Chromium opens a native menu upward unless roughly this much page remains below its select.
const MENU_ROOM = 520;
