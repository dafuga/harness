import type { Page } from '@playwright/test';
import { recordGameCapture } from './game-checkpoint-fixture';
import { recordLevelCapture } from './game-level-capture';

export async function captureGame(page: Page, name: string) {
	if (process.env.TAKE_SCREENSHOT !== 'true' && !process.env.HARNESS_EVIDENCE_DIR) return;
	await page.locator('h1').first().waitFor();
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
	const path = 'test-results/' + name + '-' + page.viewportSize()?.width + '.png';
	const bytes = await page.screenshot({ path, fullPage: true });
	await recordGameCapture(page, name, bytes);
	await recordLevelCapture(page, name, bytes);
}
