import { expect, type Locator } from '@playwright/test';

export async function assertComparePanesPreview(component: Locator, variant: string) {
	const before = component.getByRole('group', { name: /^Before ·/ });
	const after = component.getByRole('group', { name: /^(?:After|Current snapshot) ·/ });
	await expect(before).toHaveCount(variant === 'single' ? 0 : 1);
	await expect(after).toHaveCount(1);
	await expect(after).toContainText(
		variant === 'missing-selected'
			? 'No selected capture is recorded.'
			: 'Invoice approved by Daniel'
	);
	if (variant === 'missing-parent')
		await expect(before).toContainText('No parent capture is recorded.');
	else if (variant !== 'single') await expect(before).toContainText('Invoice awaiting approval');
	if (variant === 'details') {
		await expect(before).toContainText('Build: orders-parent');
		await expect(after).toContainText('Build: orders-selected');
		await expect(after).not.toContainText('orders-parent');
		await expect(before).not.toContainText('orders-selected');
	}
}
