import { expect, type Page } from '@playwright/test';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { BuildIdentityService } from '../../../../../../src/services/BuildIdentityService';
import {
	evidenceRequested,
	recordCapture
} from '../../../../../../src/utils/record-capture/recordCapture';
import { previewOrigin, servePreview } from './previewApi';
import { previewState } from './catalogUnits';
export async function openPreview(page: Page, home: string, id: string) {
	await page.route('**/*', (route) => servePreview(route, home));
	await page.clock.setFixedTime(new Date('2026-10-20T10:00:05Z'));
	await page.goto(`${previewOrigin}/?unit=${encodeURIComponent(id)}`);
}
export async function readyPreview(page: Page, id: string) {
	const content = page.locator(`[data-preview-unit="${id}"]`);
	await expect(content).toBeAttached();
	const dialog = {
		'desktop.component.deployment-activity': 'Deployments',
		'desktop.component.deployment-dialog': 'Deploy'
	}[id];
	if (dialog && !(await page.getByRole('dialog').isVisible())) {
		await content.getByRole('button', { name: dialog, exact: true }).click();
		await expect(page.getByRole('dialog')).toBeVisible();
		if (dialog === 'Deploy') await expect(page.getByText('Loading promotion…')).toHaveCount(0);
	}
	await expect.poll(() => content.locator(':visible').count()).toBeGreaterThan(0);
	await expect.poll(() => content.evaluate((node) => node.childElementCount)).toBeGreaterThan(0);
	await expect(content).not.toContainText(
		/Reading what it holds…|Reading the capture…|Loading screenshot…|Loading recorded activity…|Sampling CPU…|Checking sign-in…|Reading the request…/
	);
	await expect(content).not.toContainText(
		/Preview unavailable|Screenshot unavailable|could not be read|not listed by the evidence|Not verified|Reading the clip…|No screenshot (?:is )?recorded/
	);
	for (const img of await content.locator('img').all()) {
		await img.scrollIntoViewIfNeeded();
		await expect
			.poll(() =>
				img.evaluate(
					(node: HTMLImageElement) =>
						node.complete && node.naturalWidth > 0 && node.naturalHeight > 0
				)
			)
			.toBe(true);
		await img.evaluate((node: HTMLImageElement) => node.decode());
	}
	await page.evaluate(async () => {
		await document.fonts.ready;
		scrollTo(0, 0);
	});
	return content;
}
export async function capturePreview(page: Page, home: string, id: string, viewport: string) {
	if (!evidenceRequested() && !process.env.COMPONENT_PREVIEW_SHOTS) return;
	const bytes = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
	const state = previewState(id);
	if (process.env.COMPONENT_PREVIEW_SHOTS) {
		mkdirSync(process.env.COMPONENT_PREVIEW_SHOTS, { recursive: true });
		await import('node:fs/promises').then((fs) =>
			fs.writeFile(join(process.env.COMPONENT_PREVIEW_SHOTS!, `${state}-${viewport}.png`), bytes)
		);
	}
	if (!evidenceRequested()) return;
	const served = await new BuildIdentityService().identify(home);
	recordCapture(
		{
			evidence: 'screens',
			kind: 'screenshot',
			state,
			viewport,
			file: `${state}-${viewport}.png`,
			mediaType: 'image/png',
			provenance: 'actual-capture',
			server: {
				buildId: served?.buildId ?? 'not-built',
				revision: process.env.HARNESS_VERIFY_REVISION ?? '0'.repeat(40)
			}
		},
		bytes
	);
}
