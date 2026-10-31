import { expect, type Locator } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** An open disclosure must retain its actual content inside the original recorded crop. */
export async function assertDesktopArtifactCapture(
	component: Locator,
	id: string,
	variant: string
) {
	if (id !== 'desktop.component.runtime-artifact' || variant !== 'json-open') return;
	const directory = process.env.HARNESS_EVIDENCE_DIR;
	if (!directory || process.env.TAKE_SCREENSHOT !== '1') return;
	const raw = component.getByText('Recorded JSON', { exact: true }).locator('..').locator('pre');
	await expect(raw).toBeVisible();
	const capture = readFileSync(join(directory, 'captures.ndjson'), 'utf8')
		.split('\n')
		.filter(Boolean)
		.map((line) => JSON.parse(line))
		.findLast(
			(slot) =>
				slot.kind === 'screenshot' && slot.state === 'desktop-component-runtime-artifact-json-open'
		);
	expect(capture?.clip).toBeDefined();
	const bounds = await raw.evaluate((node) => {
		const box = node.getBoundingClientRect();
		return { top: box.top + scrollY, bottom: box.bottom + scrollY };
	});
	expect(bounds.top).toBeGreaterThanOrEqual(capture.clip.y);
	expect(
		bounds.bottom,
		'Opened recorded JSON is completely inside the captured image'
	).toBeLessThanOrEqual(capture.clip.y + capture.clip.height + 1);
}
