import type { Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { desktopEvidence } from './desktop-evidence';
import { nativeReady, type NativeExpected } from './native-readiness';

/**
 * The expected state is proved ready before any pixels are taken: the required evidence and the
 * optional TAKE_SCREENSHOT image both follow it, so neither can record a page still loading.
 */
export async function nativeCapture(page: Page, expected: NativeExpected): Promise<void> {
	await page.setViewportSize({ width: 1440, height: 900 });
	await nativeReady(page, expected);
	await desktopEvidence(page, expected.state, true);
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	await page.mouse.move(0, 0);
	await page.screenshot({
		path: fileURLToPath(
			new URL(`../../test-results/native-${expected.state}.png`, import.meta.url)
		),
		fullPage: true
	});
}
