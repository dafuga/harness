import type { Locator, Page } from '@playwright/test';

/** Frame rendered UI roots, including fragments and fixed surfaces, with a small edge allowance. */
export async function previewCaptureBounds(page: Page, id: string, variant = '') {
	const content = page.locator(`[data-preview-unit="${id}"]`);
	const { target, modal, captureElement, chatPicker } = await previewTarget(content, id, variant);
	const bounds = await target.evaluate(
		(node, { captureElement, includeUsageTooltip, chatPicker, edge }) => {
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
			const tooltip = includeUsageTooltip && node.querySelector('[role="tooltip"]');
			if (tooltip) collect(tooltip);
			const picker = chatPicker && node.querySelector('[role="dialog"]');
			if (picker) collect(picker);
			if (!boxes.length) throw new Error('The component has no rendered capture bounds.');
			const start = (value: number, scroll: number) =>
				Math.max(0, Math.floor(value + scroll) - edge);
			const left = start(Math.min(...boxes.map((box) => box.left)), scrollX);
			const top = start(Math.min(...boxes.map((box) => box.top)), scrollY);
			const right = Math.min(
				document.documentElement.scrollWidth,
				Math.ceil(Math.max(...boxes.map((box) => box.right)) + scrollX) + edge
			);
			const bottom = Math.min(
				document.documentElement.scrollHeight,
				Math.ceil(Math.max(...boxes.map((box) => box.bottom)) + scrollY) + edge
			);
			return { x: left, y: top, width: right - left, height: bottom - top };
		},
		{
			captureElement,
			chatPicker,
			includeUsageTooltip: [
				'reports.component.explorer-usage-link',
				'reports.component.explorer-usage',
				'reports.component.explorer-function-card',
				'reports.component.explorer-ui-explorer-module-card'
			].includes(id),
			edge: id === 'reports.component.evidence-grid' && modal ? 0 : 8
		}
	);
	if (id === 'reports.component.select' && variant === 'open') {
		const height = await page.evaluate(() => document.documentElement.scrollHeight);
		return { ...bounds, height: Math.min(height - bounds.y, bounds.height + 180) };
	}
	return bounds;
}

async function previewTarget(content: Locator, id: string, variant: string) {
	const dialog = content.locator('dialog[open], [role="dialog"]:visible').last();
	const modal = await previewModal(content, dialog, id, variant);
	const chatPicker =
		id === 'reports.component.console-chat' && ['model-open', 'effort-open'].includes(variant);
	const projectAgent = id === 'desktop.component.project-agent';
	const compactTarget =
		id === 'reports.component.filter-dialog' ? content.locator('.filter-trigger') : undefined;
	let target = modal ? dialog : (compactTarget ?? content);
	if (projectAgent)
		target = content.locator(
			variant === 'closed' ? '.floating-chat-bubble' : '.floating-chat-panel'
		);
	return {
		target,
		modal,
		chatPicker,
		captureElement: Boolean(modal) || projectAgent || Boolean(compactTarget)
	};
}

async function previewModal(content: Locator, dialog: Locator, id: string, variant: string) {
	if (id === 'reports.component.console-chat' && ['model-open', 'effort-open'].includes(variant))
		return false;
	return (
		(await content.getAttribute('data-preview-frame')) !== 'full' && (await dialog.count()) > 0
	);
}
