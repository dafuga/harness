import { expect, type Locator } from '@playwright/test';

/** No footer invents duplicate links or shows more than the selected limit. */
export async function assertExplorerUsageState(component: Locator, variant: string) {
	const usage = component.getByRole('group', { name: 'Used In' });
	await expect(usage).toBeVisible();
	if (variant === 'empty') {
		await expect(usage).toContainText('—');
		await expect(usage.getByRole('link')).toHaveCount(0);
	}
	if (variant === 'duplicates') await expect(usage.getByRole('link')).toHaveCount(1);
	const limits: Record<string, [number, string]> = {
		many: [3, '1 more usage'],
		limited: [1, '3 more usages'],
		'limit-zero': [0, '4 more usages']
	};
	if (limits[variant]) {
		const [count, label] = limits[variant];
		await expect(usage.getByRole('link')).toHaveCount(count);
		await expect(usage.locator('.ex-usage-more')).toHaveText(label);
	}
}
