import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { previewState } from './catalogUnits';

/** The saved picture must frame actual compact and multi-root UI, not its preview document. */
export async function assertComponentCapture(page: Page, id: string, viewport: string) {
	const directory = process.env.COMPONENT_PREVIEW_SHOTS;
	if (!directory) return;
	const selector: Record<string, string> = {
		'desktop.component.environment-picker': '.environment-choice',
		'desktop.component.deployment-route': '.deployment-route',
		'reports.component.harness-harness-icon': 'svg',
		'hub.component.account-menu': ':scope > *',
		'desktop.component.deployment-dialog': 'dialog[open]'
	};
	if (!selector[id]) return;
	const content = page.locator(`[data-preview-unit="${id}"]`);
	const boxes = await content
		.locator(selector[id])
		.evaluateAll((nodes) =>
			nodes
				.map((node) => node.getBoundingClientRect().toJSON())
				.filter((box) => box.width && box.height)
		);
	expect(boxes.length, `${id} has visible component pixels`).toBeGreaterThan(0);
	const width =
		Math.max(...boxes.map((box) => box.right)) - Math.min(...boxes.map((box) => box.left));
	const height =
		Math.max(...boxes.map((box) => box.bottom)) - Math.min(...boxes.map((box) => box.top));
	const png = readFileSync(join(directory, `${previewState(id)}-${viewport}.png`));
	expect(png.subarray(1, 4).toString()).toBe('PNG');
	const captured = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
	for (const [dimension, actual] of Object.entries({ width, height })) {
		expect(
			captured[dimension as keyof typeof captured],
			`${id} includes its full ${dimension}`
		).toBeGreaterThanOrEqual(Math.floor(actual));
		expect(
			captured[dimension as keyof typeof captured],
			`${id} excludes the preview title and empty canvas`
		).toBeLessThanOrEqual(Math.ceil(actual) + 18);
	}
}
