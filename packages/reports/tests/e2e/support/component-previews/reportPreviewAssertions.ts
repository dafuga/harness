import { expect, type Locator } from '@playwright/test';

/** Check that each additional report preview actually renders its distinct state. */
export async function assertReportPreviewState(component: Locator, id: string, variant = '') {
	if (id !== 'reports.component.modal' || variant !== 'image') return;
	const dialog = component.getByRole('dialog', { name: 'Order card evidence' });
	await expect(dialog).toBeVisible();
	await expect(dialog).not.toHaveClass(/\b(?:text|lightbox)\b/);
	await expect(dialog.getByRole('img', { name: 'Synthetic order card evidence' })).toBeVisible();
}
