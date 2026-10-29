import { expect, type Locator } from '@playwright/test';

/** Each card branch retains its real name, destination and own visual evidence. */
export async function assertModuleCardPreview(component: Locator, variant: string) {
	if (variant === 'missing' || variant === 'page-missing') {
		await expect(component.getByText('No screenshot is recorded at this revision')).toBeVisible();
		await expect(component.locator('img')).toHaveCount(0);
	}
	if (variant === 'function' || variant === 'unlinked') {
		await expect(component.locator('.ex-function-call')).toBeVisible();
		await expect(component.locator('img')).toHaveCount(0);
	}
	if (variant === 'unlinked') {
		await expect(component.locator('span.ex-function-call')).toHaveText('Orders styles');
		await expect(component.locator('a.ex-function-call')).toHaveCount(0);
	}
	if (variant === 'page') {
		await expect(component.locator('a.ex-page-open img')).toHaveAttribute(
			'src',
			'/media/synthetic-orders-page-input.svg'
		);
	}
}
