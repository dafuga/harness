import { expect, type Locator } from '@playwright/test';

/** Check that each additional report preview actually renders its distinct state. */
export async function assertReportPreviewState(component: Locator, id: string, variant = '') {
	if (id === 'reports.component.modal' && variant === 'image') {
		const dialog = component.getByRole('dialog', { name: 'Order card evidence' });
		await expect(dialog).toBeVisible();
		await expect(dialog).not.toHaveClass(/\b(?:text|lightbox)\b/);
		await expect(dialog.getByRole('img', { name: 'Synthetic order card evidence' })).toBeVisible();
	}
	if (!id.startsWith('reports.component.source-')) return;
	if (id === 'reports.component.source-file-list' && variant !== 'empty')
		await expect(component.getByRole('button', { name: 'View code', exact: true })).toHaveCount(2, {
			timeout: 1_000
		});
	if (
		!variant &&
		['source-content', 'source-dialog', 'source-viewer'].some((name) => id.endsWith(name))
	) {
		const code = component.locator('.source-code');
		await expect(code).toBeVisible();
		const fits = await code.evaluate((node) => node.scrollWidth <= node.clientWidth);
		expect(fits, 'Representative source fits without horizontal clipping').toBe(true);
	}
	if (variant === 'loading-file') {
		await expect(component.getByRole('combobox', { name: 'Source file' })).toBeVisible();
		await expect(component.getByRole('status')).toHaveText('Loading source…');
	}
	if (variant === 'loading-list') {
		await expect(component.getByRole('combobox', { name: 'Source file' })).toHaveCount(0);
		await expect(component.getByRole('status')).toHaveText('Loading source…');
	}
	if (variant === 'list-error') {
		await expect(component.getByRole('combobox', { name: 'Source file' })).toHaveCount(0);
		await expect(component.getByRole('alert')).toContainText('file list is unavailable');
	}
	if (variant === 'empty-file') {
		const pre = component.locator('.source-code');
		await expect(pre).toBeVisible();
		await expect(pre.locator('code')).toHaveText('');
	}
}
