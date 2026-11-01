import type { Locator } from '@playwright/test';
import type { PreviewBoundsOptions } from './measurePreviewBounds.types';

/** Measure the rendered component roots, retaining dialogs and excluding unused lightbox canvas. */
export async function measurePreviewBounds(target: Locator, options: PreviewBoundsOptions) {
	return target.evaluate((node, settings) => {
		const boxes: DOMRect[] = [];
		function collect(element: Element) {
			const style = getComputedStyle(element);
			if (style.display === 'none' || style.visibility === 'hidden') return;
			const box = element.getBoundingClientRect();
			if (style.display === 'contents' || !(box.width && box.height)) {
				for (const child of element.children) collect(child);
			} else boxes.push(box);
		}
		function roots() {
			if (settings.cropLightbox && node.matches('.lightbox'))
				return [
					...node.querySelectorAll('.viewer-header, .viewer-images img, .viewer-images figcaption')
				];
			if (settings.captureElement) return [node];
			return [...node.children];
		}
		for (const child of roots()) collect(child);
		for (const dialog of node.querySelectorAll('dialog[open], [role="dialog"]')) collect(dialog);
		const tooltip =
			settings.includeUsageTooltip &&
			node.querySelector('[role="tooltip"], .reason[role="status"]');
		if (tooltip) collect(tooltip);
		if (!boxes.length) throw new Error('The component has no rendered capture bounds.');
		const start = (value: number, scroll: number) =>
			Math.max(0, Math.floor(value + scroll) - settings.edge);
		const left = start(Math.min(...boxes.map((box) => box.left)), scrollX);
		const top = start(Math.min(...boxes.map((box) => box.top)), scrollY);
		const right = Math.min(
			document.documentElement.scrollWidth,
			Math.ceil(Math.max(...boxes.map((box) => box.right)) + scrollX) + settings.edge
		);
		const bottom = Math.min(
			document.documentElement.scrollHeight,
			Math.ceil(Math.max(...boxes.map((box) => box.bottom)) + scrollY) + settings.edge
		);
		return { x: left, y: top, width: right - left, height: bottom - top };
	}, options);
}
