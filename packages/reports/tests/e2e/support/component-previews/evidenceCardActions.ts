import { expect, type Locator } from '@playwright/test';

/** Reach the compact disclosure and check the visible card branch. */
export async function prepareEvidenceCard(component: Locator, variant: string) {
	if (['compact', 'compact-closed'].includes(variant))
		await expect(component.locator('.image-button')).toHaveCSS('padding', '0px');
	if (variant === 'compact') {
		await component.locator('summary').click();
		await expect(component.getByText('Chromium capture', { exact: true })).toBeVisible();
	}
	if (variant === 'compact-closed')
		await expect(component.locator('details')).not.toHaveAttribute('open');
	if (variant === 'single-audio') return expect(component.locator('.audio-card')).toBeVisible();
	if (variant === 'paired-audio')
		return expect(component.locator('.audio-comparison-card')).toBeVisible();
	const missing = ['missing', 'image-error'].includes(variant);
	if (missing) await expect(component.locator('.image-button')).toBeDisabled();
	else await expect(component.locator('.image-button')).toBeEnabled();
	if (variant === 'minimal') {
		await expect(component.locator('.evidence-provenance')).toHaveCount(0);
		await expect(component.locator('.evidence-meta time')).toHaveCount(0);
	}
	if (['running', 'failed', 'blocked', 'skipped', 'not-proven', 'interrupted'].includes(variant))
		await expect(component.locator('.badge')).toHaveClass(new RegExp(variant));
}
