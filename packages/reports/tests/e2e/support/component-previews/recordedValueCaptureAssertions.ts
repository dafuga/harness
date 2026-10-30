import { expect, type Locator } from '@playwright/test';

/** A type label must remain readable alongside a long recorded value. */
export async function assertRecordedValueCapture(component: Locator, id: string, variant: string) {
	if (id !== 'reports.component.recorded-value' || !['long-text', 'custom-label'].includes(variant))
		return;
	const lines = await component
		.locator('.value-type')
		.first()
		.evaluate((node) => {
			const range = document.createRange();
			range.selectNodeContents(node);
			return range.getClientRects().length;
		});
	expect(lines, 'The value type label stays on one line').toBe(1);
}
