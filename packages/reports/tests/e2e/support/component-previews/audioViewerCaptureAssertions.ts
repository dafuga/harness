import { expect, type Page } from '@playwright/test';

/** Both complete recordings must be inside the mobile dialog capture. */
export async function assertAudioViewerCapture(page: Page, id: string, viewport: string) {
	if (id !== 'reports.component.audio-comparison-viewer' || viewport !== 'mobile') return;
	const component = page.locator(`[data-preview-unit="${id}"]`);
	const sides = component.locator('.audio-comparison-side');
	if ((await sides.count()) !== 2) return;
	const dialog = await component.locator('dialog[open]').boundingBox();
	for (const side of await sides.all()) {
		await expect(side.locator('.evidence-provenance')).toBeVisible();
		const bounds = await side.boundingBox();
		expect(bounds!.y, 'Recordings start inside the mobile capture').toBeGreaterThanOrEqual(
			dialog!.y
		);
		expect(
			bounds!.y + bounds!.height,
			'Both recordings fit in the mobile capture'
		).toBeLessThanOrEqual(dialog!.y + dialog!.height);
	}
}
