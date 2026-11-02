import { expect, type Locator } from '@playwright/test';

/** At phone width each revision trigger keeps its icon and label fully inside its padding. */
export async function assertRevisionTriggerContent(component: Locator, width: number) {
	if (width > 560) return;
	const buttons = component.locator('.revision-choices > button');
	const count = await buttons.count();
	for (let index = 0; index < count; index++) {
		const fits = await buttons.nth(index).evaluate((node) => {
			const box = node.getBoundingClientRect();
			const style = getComputedStyle(node);
			const left = box.left + parseFloat(style.paddingLeft);
			const right = box.right - parseFloat(style.paddingRight);
			const within = (rect: DOMRect) =>
				rect.width > 0 && rect.left >= left - 1 && rect.right <= right + 1;
			const icon = node.querySelector('svg')!.getBoundingClientRect();
			const range = document.createRange();
			range.selectNodeContents(node.querySelector('span')!);
			const label = range.getBoundingClientRect();
			return within(icon) && icon.width >= 10 && within(label);
		});
		expect(
			fits,
			'Revision trigger icon and label fit fully inside its padding at phone width'
		).toBe(true);
	}
}
