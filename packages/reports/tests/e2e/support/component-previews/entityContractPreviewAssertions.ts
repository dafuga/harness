import { expect, type Locator } from '@playwright/test';

/** Each contract state exposes the part of the source declaration it represents. */
export async function assertEntityContractState(component: Locator, variant: string) {
	const expected: Record<string, string> = {
		empty: 'No props declared.',
		errors: 'Errors',
		last: 'Last contract · 7561ee4',
		'example-open': 'Example for Orders',
		function: 'filterOrders(orders, searchText)',
		'function-error': 'Throws',
		service: 'read(accountId)',
		model: 'Order',
		'model-bare': 'This revision records no public methods or fields of this model.',
		types: 'OrderInput',
		config: 'Provides'
	};
	if (expected[variant])
		await expect(component.getByText(expected[variant], { exact: false }).first()).toBeVisible();
}

/** Text, badges and controls must remain disjoint for every mobile contract table row. */
export async function assertMobileContractFields(component: Locator) {
	const rows = component.locator('[data-harness-component="contract-table"] tbody tr');
	for (const row of await rows.all()) {
		const overlaps = await row.evaluate((node) => {
			const parts = Array.from(node.querySelectorAll('th, .type, .example, button.info')).map(
				(element) => {
					const range = document.createRange();
					range.selectNodeContents(element);
					const box = element.matches('th')
						? range.getBoundingClientRect()
						: element.getBoundingClientRect();
					return {
						label: element.textContent?.trim() || element.getAttribute('aria-label') || '',
						left: box.left,
						right: box.right,
						top: box.top,
						bottom: box.bottom
					};
				}
			);
			const conflicts: string[] = [];
			for (const [index, first] of parts.entries()) {
				for (const second of parts.slice(index + 1)) {
					if (
						first.left < second.right - 1 &&
						second.left < first.right - 1 &&
						first.top < second.bottom - 1 &&
						second.top < first.bottom - 1
					)
						conflicts.push(`${first.label} overlaps ${second.label}`);
				}
			}
			return conflicts;
		});
		expect(overlaps, 'Mobile contract values do not overlap').toEqual([]);
	}
}
