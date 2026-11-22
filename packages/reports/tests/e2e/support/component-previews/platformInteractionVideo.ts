import { expect } from '@playwright/test';
import type {
	NativeRecordingScript,
	NativeRecordingSession
} from '../../../../../../src/services/verification-evidence/NativeVideoRecorderService.types';
import {
	platformCheckpoint,
	preparePlatform,
	resetPlatformBoundary,
	type PlatformVideoSetup
} from './platformVideoCheckpoint';

/** The real 150ms card transition and the native picker are independently recordable states. */
export function record(
	setup: PlatformVideoSetup & { fixture: { interaction: 'hover' | 'picker' } }
) {
	return {
		async prepare({ page }: NativeRecordingSession) {
			await preparePlatform(page, setup);
			await page.mouse.move(1, 1);
		},
		checkpoint: ({ page }: NativeRecordingSession) => platformCheckpoint(page),
		async perform({ page, mark }: NativeRecordingScript) {
			await mark('state', 'ready');
			if (setup.fixture.interaction === 'hover') {
				const card = page
					.locator('.pf-card')
					.filter({ has: page.getByRole('link', { name: 'View Web configuration', exact: true }) });
				const before = await card.evaluate((node) => getComputedStyle(node).borderTopColor);
				await card.hover();
				await expect
					.poll(() => card.evaluate((node) => getComputedStyle(node).borderTopColor))
					.not.toBe(before);
				await mark('edge', 'hover');
				await mark('state', 'hovered');
				await page.waitForTimeout(600);
				await page.mouse.move(1, 1);
				await expect
					.poll(() => card.evaluate((node) => getComputedStyle(node).borderTopColor))
					.toBe(before);
				await mark('edge', 'leave');
			} else {
				await page.getByRole('button', { name: 'Filters', exact: true }).click();
				const dialog = page.getByRole('dialog', { name: 'Filters', exact: true });
				await expect(dialog).toBeVisible();
				const picker = dialog.getByRole('combobox', { name: 'Status filter' });
				await picker.click();
				await expect.poll(() => picker.evaluate((node) => node.matches(':open'))).toBe(true);
				await mark('edge', 'open-picker');
				await mark('state', 'picker-open');
				await page.waitForTimeout(800);
				await page.keyboard.press('Escape');
				await dialog.getByRole('button', { name: 'Done', exact: true }).click();
				await expect(dialog).not.toBeVisible();
				await mark('edge', 'close-picker');
			}
			await resetPlatformBoundary(page);
			await mark('state', 'ready');
			await page.waitForTimeout(500);
		}
	};
}
