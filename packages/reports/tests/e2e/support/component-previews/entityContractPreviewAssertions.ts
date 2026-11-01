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

/** Standalone contract examples and tables inherit the Explorer's shared primary token. */
export async function assertContractTypeColor(component: Locator) {
	const colors = await component
		.locator('code.type')
		.first()
		.evaluate((node) => {
			const probe = document.createElement('span');
			probe.style.color = 'var(--hx-color-primary)';
			node.append(probe);
			const expected = getComputedStyle(probe).color;
			probe.remove();
			return { actual: getComputedStyle(node).color, expected };
		});
	expect(colors.actual, 'Contract type uses the Explorer primary color').toBe(colors.expected);
}

/** Text, badges and controls must remain disjoint for every mobile contract table row. */
export async function assertMobileContractFields(component: Locator) {
	const rows = component.locator('[data-harness-component="contract-table"] tbody tr');
	for (const row of await rows.all()) {
		const overlaps = await row.evaluate((node) => {
			const parts = Array.from(
				node.querySelectorAll('th, .type, .example, .requirement, .default, button.info')
			).map((element) => {
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
			});
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

/** Every declared input keeps requirement/default metadata in the captured contract. */
export async function assertContractMetadata(component: Locator, id: string, variant: string) {
	if (
		![
			'reports.component.entity-contract',
			'reports.component.contract-table',
			'desktop.component.contract-panel'
		].includes(id)
	)
		return;
	const rows = component.locator('[data-contract-input]');
	const empty = [
		'empty',
		'empty-kept',
		'plain-empty',
		'hide-names',
		'model-bare',
		'config'
	].includes(variant);
	if (!empty)
		expect(await rows.count(), 'Declared contract inputs expose their metadata').toBeGreaterThan(0);
	for (const row of await rows.all()) {
		await expect(row.locator('.requirement')).toHaveText(
			/^(Required|Optional|Requiredness not recorded)$/
		);
		await expect(row.locator('.default')).toContainText(/Default: .+|No default/);
		const clipped = await row.evaluate((node) =>
			Array.from(node.querySelectorAll('.requirement, .default')).some((item) => {
				const box = item.getBoundingClientRect();
				return (
					box.left < 0 ||
					box.right > window.innerWidth + 1 ||
					item.scrollWidth > item.clientWidth + 1
				);
			})
		);
		expect(clipped, 'Contract metadata stays readable within the viewport').toBe(false);
	}
	await assertContractMetadataGroups(component, id, variant, empty);
}

async function assertContractMetadataGroups(
	component: Locator,
	id: string,
	variant: string,
	empty: boolean
) {
	const rows = component.locator('[data-contract-input]');
	if (id === 'reports.component.entity-contract') {
		await expect(
			component.getByText(/No errors declared\.|TypeError|NotFoundError/).first()
		).toBeVisible();
		if (variant.startsWith('function'))
			await expect(component.getByRole('table', { name: 'Returns', exact: true })).toBeVisible();
	}
	if (
		['', 'last', 'function', 'function-error'].includes(variant) &&
		id === 'reports.component.entity-contract'
	) {
		await expect(rows.locator('.requirement')).toHaveText(['Required', 'Optional']);
		await expect(rows.locator('.default')).toContainText(['No default', 'Default: ""']);
	}
	if (id === 'reports.component.contract-table' && !empty) {
		await expect(
			component.getByRole('columnheader', { name: 'Requirement', exact: true })
		).toHaveCount(1);
		await expect(component.getByRole('columnheader', { name: 'Default', exact: true })).toHaveCount(
			1
		);
	}
}
