import type { Page } from '@playwright/test';

/** Frame rendered UI roots, including fragments and fixed surfaces, with a small edge allowance. */
export async function previewCaptureBounds(page: Page, id: string) {
	const content = page.locator(`[data-preview-unit="${id}"]`);
	const dialog = content.locator('dialog[open], [role="dialog"]:visible').last();
	const modal =
		(await content.getAttribute('data-preview-frame')) !== 'full' && (await dialog.count());
	const target = modal ? dialog : content;
	return target.evaluate((node, modal) => {
		const boxes: DOMRect[] = [];
		function collect(element: Element) {
			const style = getComputedStyle(element);
			if (style.display === 'none' || style.visibility === 'hidden') return;
			const box = element.getBoundingClientRect();
			if (style.display === 'contents' || !(box.width && box.height)) {
				for (const child of element.children) collect(child);
			} else boxes.push(box);
		}
		if (modal) collect(node);
		else for (const child of node.children) collect(child);
		if (!boxes.length) throw new Error('The component has no rendered capture bounds.');
		const left = Math.max(0, Math.floor(Math.min(...boxes.map((box) => box.left)) + scrollX) - 8);
		const top = Math.max(0, Math.floor(Math.min(...boxes.map((box) => box.top)) + scrollY) - 8);
		const right = Math.min(
			document.documentElement.scrollWidth,
			Math.ceil(Math.max(...boxes.map((box) => box.right)) + scrollX) + 8
		);
		const bottom = Math.min(
			document.documentElement.scrollHeight,
			Math.ceil(Math.max(...boxes.map((box) => box.bottom)) + scrollY) + 8
		);
		return { x: left, y: top, width: right - left, height: bottom - top };
	}, Boolean(modal));
}
