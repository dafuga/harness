import type { Locator } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildStamp } from '../../../../src/utils/buildStamp';
import {
	evidenceRequested,
	recordCapture
} from '../../../../src/utils/reports-media/record-capture/recordCapture';
import { expect, type Page } from '../../../../test/support/browserTest';
import type { CapturePosition } from './hub-home-fixture.types';

export async function fullDialog(page: Page, position: CapturePosition, screen: string) {
	const [id, scheme, state] = position;
	if (
		process.env.TAKE_SCREENSHOT !== 'true' ||
		state !== 'default' ||
		scheme !== 'dark' ||
		!['phone', 'laptop'].includes(id)
	)
		return;
	const viewport = page.viewportSize()!;
	const height = await page.getByRole('dialog').evaluate((element) => {
		const body = element.querySelector('.hh-dialog-body')!;
		const chrome = element.clientHeight - body.clientHeight;
		return body.scrollHeight + chrome;
	});
	await page.setViewportSize({
		width: viewport.width,
		height: Math.max(viewport.height, height + (id === 'phone' ? 0 : 84))
	});
	try {
		await capture(page, position, screen, true);
	} finally {
		await page.setViewportSize(viewport);
	}
}

export async function capture(page: Page, position: CapturePosition, screen: string, full = false) {
	const [size, scheme, state] = position;
	const registryCapture = screen === 'root' && scheme === 'dark' && evidenceRequested();
	if (process.env.TAKE_SCREENSHOT !== 'true' && !registryCapture) return;
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all(Array.from(document.images, (image) => image.decode()));
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
		);
	});
	const options = { fullPage: screen === 'root', animations: 'disabled', caret: 'hide' } as const;
	if (registryCapture) {
		const stamp = await page.locator('meta[name="harness-build"]').getAttribute('content');
		const buildId = buildStamp(stamp ?? undefined);
		const revision = process.env.HARNESS_VERIFY_REVISION;
		if (!buildId || !revision) throw new Error('Hub home captures need the verified build stamp.');
		recordCapture(
			{
				evidence: 'home-screen',
				kind: 'screenshot',
				state,
				viewport: size,
				file: `hub-home-${state}-${size}.png`,
				mediaType: 'image/png',
				provenance: 'actual-capture',
				server: { buildId, revision }
			},
			await page.screenshot(options)
		);
	}
	if (process.env.TAKE_SCREENSHOT === 'true') {
		const directory = join(process.env.SCREENSHOT_DIR ?? '/tmp/harness-hub-home', size);
		mkdirSync(directory, { recursive: true });
		await page.screenshot({
			...options,
			path: join(directory, `${screen}--${state}--${scheme}${full ? '--full' : ''}.png`)
		});
	}
}

export async function captureNeedsYou(page: Page, name: string, target: Page | Locator = page) {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const directory = process.env.SCREENSHOT_DIR ?? 'test-results/needs-you';
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all(Array.from(document.images, (image) => image.decode()));
	});
	await target.screenshot({
		path: `${directory}/${process.env.SCREENSHOT_LABEL ?? 'current'}-${name}.png`,
		animations: 'disabled'
	});
}

export async function captureHomeTop(page: Page, path: string) {
	if (process.env.TAKE_SCREENSHOT === 'true') {
		await page.evaluate(() => document.fonts.ready.then(() => {}));
		await page.screenshot({ path: path });
	}
}

export async function expectLaunchPause(page: Page, overview: Locator, path: string) {
	const hold = overview.locator('.hh-live-row', { hasText: 'Waiting on CI maintenance' });
	if (process.env.TAKE_SCREENSHOT === 'true') {
		await page.evaluate(async () => {
			await document.fonts.ready;
			await Promise.all([...document.images].map((img) => img.decode()));
		});
		await page.screenshot({
			path,
			animations: 'disabled',
			fullPage: true
		});
	}
	await expect(hold).toContainText('Launch paused');
	await expect(hold).toContainText('Automatic launch paused by operator until');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('for 14 agents');
}
