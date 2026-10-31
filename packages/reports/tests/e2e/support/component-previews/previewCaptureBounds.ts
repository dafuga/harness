import type { Locator, Page } from '@playwright/test';
import { measurePreviewBounds } from './measurePreviewBounds';

const tooltipUnits = new Set([
	'reports.component.harness-harness-verdict',
	'desktop.component.status-icon',
	'reports.component.explorer-usage-link',
	'reports.component.explorer-usage',
	'reports.component.explorer-function-card',
	'reports.component.explorer-ui-explorer-module-card'
]);

const emptyStates: Record<string, string> = {
	'reports.component.module-system-plugins-plugin-steps:empty': '.mod-steps',
	'reports.component.shared-primitives-detail-list:empty-unprovided': '.detail-list'
};

/** Frame rendered UI roots, including fragments and fixed surfaces, with a small edge allowance. */
export async function previewCaptureBounds(page: Page, id: string, variant = '') {
	if (isPlatformPicker(id, variant)) return platformPickerBounds(page);
	if (await reportViewDialog(page, id)) {
		const viewport = page.viewportSize();
		if (!viewport) throw new Error('Report dialog capture requires a viewport.');
		return { x: 0, y: 0, ...viewport };
	}
	const content = page.locator(`[data-preview-unit="${id}"]`);
	const empty = emptyStates[`${id}:${variant}`];
	if (empty) return emptyContentBounds(content, empty);
	const selected = await previewTarget(content, id, variant);
	const bounds = await measurePreviewBounds(selected.target, {
		captureElement: selected.captureElement,
		chatPicker: selected.chatPicker,
		includeUsageTooltip: tooltipUnits.has(id),
		cropLightbox: id === 'reports.component.modal',
		edge:
			selected.modal &&
			['reports.component.evidence-grid', 'reports.component.entity-states'].includes(id)
				? 0
				: 8
	});
	if (id === 'reports.component.replay-controls' && ['speed-open', 'scene-open'].includes(variant))
		return replayPickerBounds(page, bounds, variant);
	return bounds;
}

/** An empty list has zero content height; retain its real boundary and the normal edge allowance. */
async function emptyContentBounds(content: Locator, selector: string) {
	const target = selector === ':self' ? content : content.locator(selector);
	return target.evaluate((node) => {
		const box = node.getBoundingClientRect();
		const x = Math.max(0, Math.floor(box.left + scrollX) - 8);
		const y = Math.max(0, Math.floor(box.top + scrollY) - 8);
		return {
			x,
			y,
			width: Math.min(innerWidth, Math.ceil(box.right + scrollX) + 8) - x,
			height: Math.ceil(box.height) + 16
		};
	});
}

function isPlatformPicker(id: string, variant: string) {
	return (
		id === 'reports.component.explorer-ui-explorer-platforms' && variant === 'status-options-open'
	);
}

/** Include the open options and dialog without the preview-only page around them. */
async function platformPickerBounds(page: Page) {
	return page.getByRole('dialog', { name: 'Filters' }).evaluate((dialog) => {
		const options = [...dialog.querySelectorAll('option')].map((option) =>
			option.getBoundingClientRect()
		);
		if (!options.length || options.some((box) => !box.width || !box.height))
			throw new Error('Platform status options have no rendered bounds.');
		const boxes = [dialog.getBoundingClientRect(), ...options];
		if (
			boxes.some(
				(box) => box.left < 0 || box.top < 0 || box.right > innerWidth || box.bottom > innerHeight
			)
		)
			throw new Error('Platform status dialog or options extend outside the viewport.');
		const left = Math.max(0, Math.floor(Math.min(...boxes.map((box) => box.left)) - 8));
		const top = Math.max(0, Math.floor(Math.min(...boxes.map((box) => box.top)) - 8));
		const right = Math.min(innerWidth, Math.ceil(Math.max(...boxes.map((box) => box.right)) + 8));
		const bottom = Math.min(
			innerHeight,
			Math.ceil(Math.max(...boxes.map((box) => box.bottom)) + 8)
		);
		return { x: left + scrollX, y: top + scrollY, width: right - left, height: bottom - top };
	});
}

/** Full-frame report dialogs must be captured in the visible viewport. */
export async function reportViewDialog(page: Page, id: string) {
	return (
		id === 'reports.component.report-view' &&
		(await page.locator(`[data-preview-unit="${id}"]`).getByRole('dialog').count()) > 0
	);
}

async function replayPickerBounds(
	page: Page,
	bounds: { x: number; y: number; width: number; height: number },
	variant: string
) {
	const name = variant === 'speed-open' ? 'Playback speed' : 'Jump to scene';
	const bottom = await page.getByRole('combobox', { name }).evaluate((node: HTMLSelectElement) => {
		const options = [...node.options].map((option) => option.getBoundingClientRect());
		const visible = options.filter((box) => box.width > 0 && box.height > 0);
		const popupBottom = visible.length
			? Math.max(...visible.map((box) => box.bottom))
			: node.getBoundingClientRect().bottom + options.length * 26;
		return Math.ceil(popupBottom + scrollY) + 8;
	});
	const height = await page.evaluate(() => document.documentElement.scrollHeight);
	return {
		...bounds,
		height: Math.min(height - bounds.y, Math.max(bounds.height, bottom - bounds.y))
	};
}

async function previewTarget(content: Locator, id: string, variant: string) {
	const dialog = content.locator('dialog[open], [role="dialog"]:visible').last();
	const chatPicker =
		id === 'reports.component.console-chat' &&
		['model-open', 'model-selected', 'effort-open', 'effort-selected'].includes(variant);
	const modal = await previewModal(content, dialog, chatPicker);
	const projectAgent = id === 'desktop.component.project-agent';
	const replayFull = id === 'reports.component.gameplay-replay' && variant === 'fullscreen';
	const compactTarget =
		id === 'reports.component.filter-dialog' ? content.locator('.filter-trigger') : undefined;
	const target =
		id === 'reports.component.shared-primitives-loading-state'
			? content.locator('.hx-loading')
			: previewTargetElement(content, dialog, { id, variant, modal, compactTarget });
	return {
		target,
		modal,
		chatPicker,
		captureElement: Boolean(modal) || projectAgent || replayFull || Boolean(compactTarget)
	};
}

function previewTargetElement(
	content: Locator,
	dialog: Locator,
	{
		id,
		variant,
		modal,
		compactTarget
	}: {
		id: string;
		variant: string;
		modal: boolean;
		compactTarget?: Locator;
	}
) {
	if (id === 'desktop.component.project-agent')
		return content.locator(variant === 'closed' ? '.floating-chat-bubble' : '.floating-chat-panel');
	if (id === 'reports.component.gameplay-replay' && variant === 'fullscreen')
		return content.locator('.replay-player.full');
	return modal ? dialog : (compactTarget ?? content);
}

async function previewModal(content: Locator, dialog: Locator, chatPicker: boolean) {
	if (chatPicker) return false;
	return (
		(await content.getAttribute('data-preview-frame')) !== 'full' && (await dialog.count()) > 0
	);
}
