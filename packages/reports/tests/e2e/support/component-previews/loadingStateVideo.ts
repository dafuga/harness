import { expect } from '@playwright/test';
import type {
	NativeRecordingScript,
	NativeRecordingSession
} from '../../../../../../src/services/verification-evidence/NativeVideoRecorderService.types';
import { previewOrigin, servePreview } from './previewApi';
import { readyVideoMedia, videoSignature } from './platformVideoCheckpoint';

const unit = 'reports.component.shared-primitives-loading-state';
/** Normal motion runs for at least two observed CSS animation cycles. */
export function record(setup: { home: string }) {
	return {
		async prepare({ page }: NativeRecordingSession) {
			await page.route('**/*', (route) => servePreview(route, setup.home));
			await page.goto(`${previewOrigin}/?unit=${encodeURIComponent(unit)}`);
			await expect(page.locator(`[data-preview-unit="${unit}"]`)).toBeAttached();
			await expect(page.getByRole('status')).toBeVisible();
			await readyVideoMedia(page);
			await expect(page.getByRole('status')).toContainText('Loading');
		},
		async checkpoint({ page }: NativeRecordingSession) {
			return videoSignature(
				await page.evaluate(() => ({
					route: location.pathname,
					unit: new URL(location.href).searchParams.get('unit'),
					viewport: [innerWidth, innerHeight],
					scroll: [scrollX, scrollY],
					focus: document.activeElement?.tagName,
					role: 'fixture-reviewer'
				}))
			);
		},
		async perform({ page, mark }: NativeRecordingScript) {
			const ring = page.locator('.hx-loading-indicator');
			await expect(ring).toBeInViewport();
			const motion = await ring.evaluate((node) => ({
				name: getComputedStyle(node).animationName,
				seconds: parseFloat(getComputedStyle(node).animationDuration)
			}));
			expect(motion.name).toContain('hx-loading-turn');
			expect(motion.seconds).toBeGreaterThan(0);
			expect(motion.seconds).toBeLessThanOrEqual(2);
			await mark('state', 'loading');
			const first = await ring.evaluate((node) => getComputedStyle(node).transform);
			await page.waitForTimeout(137);
			const next = await ring.evaluate((node) => getComputedStyle(node).transform);
			expect(next).not.toBe(first);
			await page.waitForTimeout(Math.ceil(motion.seconds * 2100));
			await expect(page.getByRole('status')).toContainText('Loading');
			await mark('state', 'loading');
		}
	};
}
