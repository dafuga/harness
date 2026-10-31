import { expect, type Locator } from '../../../../../../test/support/browserTest';

/** A narrow action column keeps the short label and arrow inside one clickable row. */
export async function assertExplorerTableActions(component: Locator) {
	for (const action of await component.getByRole('link', { name: /^Open / }).all()) {
		const fits = await action.evaluate((node) => {
			const text = [...node.childNodes].find(
				(child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim() === 'Open'
			);
			if (!text) return false;
			const range = document.createRange();
			range.selectNodeContents(text);
			const lines = [...range.getClientRects()].filter((box) => box.width > 0);
			const frame = node.getBoundingClientRect();
			const icon = node.querySelector('svg')?.getBoundingClientRect();
			return (
				lines.length === 1 && lines[0].right <= frame.right && !!icon && icon.right <= frame.right
			);
		});
		expect(fits, 'Explorer table Open action stays on one line with its arrow').toBe(true);
	}
}

/** Category examples need real rows; empty and multiline values keep their table semantics. */
export async function assertExplorerTablePresentation(component: Locator, variant: string) {
	const table = component.getByRole('table');
	const examples: Record<string, string> = {
		apis: '/api/orders',
		layouts: 'OrdersFrame',
		models: 'Order',
		types: 'OrderInput',
		platforms: 'Website'
	};
	if (examples[variant]) {
		await expect(
			table.locator('tbody tr').first(),
			'Category state contains a representative row'
		).toBeVisible();
		await expect(table.getByRole('link', { name: examples[variant], exact: true })).toBeVisible();
		await expect(component.getByText('No rows to display.')).toHaveCount(0);
	}
	if (variant === 'empty') {
		const empty = table.locator('tbody td');
		await expect(empty, 'Empty feedback belongs inside the table body').toHaveText(
			'No rows to display.'
		);
		await expect(empty).toHaveAttribute('colspan', String(await table.locator('thead th').count()));
	}
	if (variant === 'multiline-string') {
		const code = table.locator('.code-line code');
		await expect(code).toHaveText('Ready to ship.\nRelease reviewed.\nOrder confirmed.');
		await expect(code, 'Multiline literal preserves its line breaks').toHaveCSS(
			'white-space',
			'pre-wrap'
		);
		const lines = await code.evaluate((node) => {
			const style = getComputedStyle(node);
			return node.getBoundingClientRect().height / parseFloat(style.lineHeight);
		});
		expect(lines, 'Three source lines paint as three visible lines').toBeGreaterThanOrEqual(2.9);
	}
}
