import type { Locator } from '@playwright/test';
import type { PreviewBoundsOptions } from './measurePreviewBounds.types';

/** Measure the rendered component roots, retaining dialogs and excluding unused lightbox canvas. */
export async function measurePreviewBounds(target: Locator, options: PreviewBoundsOptions) {
	return target.evaluate(captureBounds, options);
}

function captureBounds(node: Element, settings: PreviewBoundsOptions) {
	const boxes: DOMRect[] = [];
	function collect(element: Element) {
		const style = getComputedStyle(element);
		if (style.display === 'none' || style.visibility === 'hidden') return;
		const box = element.getBoundingClientRect();
		if (style.display !== 'contents' && box.width && box.height) boxes.push(box);
		else Array.from(element.children).forEach(collect);
	}
	function roots() {
		if (settings.cropLightbox && node.matches('.lightbox'))
			return [
				...node.querySelectorAll('.viewer-header, .viewer-images img, .viewer-images figcaption')
			];
		if (settings.captureElement) return [node];
		return [...node.children];
	}
	roots().forEach(collect);
	node.querySelectorAll('dialog[open], [role="dialog"]').forEach(collect);
	if (settings.includeUsageTooltip) {
		for (const selector of ['button.verification', '[role="tooltip"], .reason[role="status"]']) {
			const match = node.querySelector(selector);
			if (match) collect(match);
		}
	}
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
}
