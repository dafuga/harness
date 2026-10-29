import { expect, type Locator } from '@playwright/test';

/** Each contract state exposes the part of the source declaration it represents. */
export async function assertEntityContractState(component: Locator, variant: string) {
	const expected: Record<string, string> = {
		empty: 'No props declared.',
		errors: 'Errors',
		last: 'Last contract · bbbbbbb',
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
