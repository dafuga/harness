import type { Page } from '@playwright/test';

/** Frame rendered UI roots, including fragments and fixed surfaces, with a small edge allowance. */
export async function previewCaptureBounds(page: Page, id: string, variant = '') {
	const content = page.locator(`[data-preview-unit="${id}"]`);
	const dialog = content.locator('dialog[open], [role="dialog"]:visible').last();
	const modal =
		(await content.getAttribute('data-preview-frame')) !== 'full' && (await dialog.count());
	const projectAgent = id === 'desktop.component.project-agent';
	const compactTarget =
		id === 'reports.component.filter-dialog' ? content.locator('.filter-trigger') : undefined;
	let target = modal ? dialog : (compactTarget ?? content);
	if (projectAgent)
		target = content.locator(
			variant === 'closed' ? '.floating-chat-bubble' : '.floating-chat-panel'
		);
	const bounds = await target.evaluate(
		(node, captureElement) => {
			const boxes: DOMRect[] = [];
			function collect(element: Element) {
				const style = getComputedStyle(element);
				if (style.display === 'none' || style.visibility === 'hidden') return;
				const box = element.getBoundingClientRect();
				if (style.display === 'contents' || !(box.width && box.height)) {
					for (const child of element.children) collect(child);
				} else boxes.push(box);
			}
			if (captureElement) collect(node);
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
		},
		Boolean(modal) || projectAgent || Boolean(compactTarget)
	);
	if (id === 'reports.component.select' && variant === 'open') {
		const height = await page.evaluate(() => document.documentElement.scrollHeight);
		return { ...bounds, height: Math.min(height - bounds.y, bounds.height + 180) };
	}
	return bounds;
}
