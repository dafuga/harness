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
