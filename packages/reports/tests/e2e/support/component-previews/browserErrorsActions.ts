import { expect, type Locator } from '@playwright/test';

/** Open the actual disclosure and check the classified diagnostic before capture. */
export async function prepareBrowserErrors(component: Locator, variant: string) {
	if (variant === 'unavailable' || variant === 'empty') {
		const message =
			variant === 'unavailable'
				? 'Browser diagnostics are unavailable for this record.'
				: 'No browser diagnostic entries were recorded.';
		await expect(component.getByText(message)).toBeVisible();
		await expect(component.locator('details')).toHaveCount(0);
		return;
	}
	const details = component.locator('details');
	const count = variant === 'zero-entries' ? 0 : variant === 'multiple' ? 2 : 1;
	await expect(details.locator('summary')).toHaveText(
		new RegExp(`^Browser errors · ${count} entr(?:y|ies)$`)
	);
	if (!variant) {
		await expect(details).not.toHaveAttribute('open');
		return;
	}
	await details.locator('summary').click();
	await expect(details).toHaveAttribute('open', '');
	if (variant === 'zero-entries') {
		await expect(details.locator('li')).toHaveCount(0);
		return;
	}
	await assertClassification(details, variant);
}

async function assertClassification(details: Locator, variant: string) {
	const statuses: Record<string, string> = {
		'expected-open': 'Expected',
		unexpected: 'Unexpected',
		exception: 'Uncaught exception',
		'missing-expected': 'Missing expected error',
		multiple: 'Unexpected'
	};
	await expect(details).toContainText(statuses[variant]);
	if (variant === 'unexpected') await expect(details).toContainText('checkout.ts:42:9');
	if (variant === 'exception') await expect(details).toContainText('loadReceipt');
	if (variant === 'multiple') await expect(details.locator('section')).toHaveCount(2);
}
