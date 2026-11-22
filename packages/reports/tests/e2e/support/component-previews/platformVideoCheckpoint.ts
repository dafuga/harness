import { createHash } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { platformFixture } from '../../../../test/platformFixture';
import { servePreview } from './previewApi';
import type { PlatformVideoSetup } from './platformVideoCheckpoint.types';
export type { PlatformVideoSetup } from './platformVideoCheckpoint.types';
export const platformNames = ['Web', 'iOS', 'Android', 'Desktop (Electron)'];
export const platformRoute = '/harness/branch/feature%2Forders/platforms';
const fixture = createHash('sha256').update(JSON.stringify(platformFixture)).digest('hex');
export const videoSignature = (value: unknown) =>
	createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** The real built page reads a sealed synthetic history; only its chat API is intercepted. */
export async function preparePlatform(page: Page, setup: PlatformVideoSetup) {
	if (setup.expectedBuild) {
		const health = await (await fetch(setup.origin + '/api/health')).json();
		expect(
			{ buildId: health.buildId, revision: health.revision },
			'the pilot server must serve the exact frozen build'
		).toEqual(setup.expectedBuild);
	}
	await page.route(`${setup.origin}/api/agent`, (route) => servePreview(route, setup.home));
	await page.goto(setup.origin + platformRoute);
	await expect(page.getByRole('heading', { name: 'Platforms', exact: true })).toBeVisible();
	await expect(platformLinks(page)).toHaveCount(4);
	await readyVideoMedia(page);
	await resetPlatformBoundary(page);
}
export const platformLinks = (page: Page) =>
	page.getByRole('link', { name: /^View .* configuration$/ });

export async function resetPlatformBoundary(page: Page) {
	await page.getByRole('searchbox', { name: 'Search platforms' }).focus();
	await page.evaluate(() => window.scrollTo(0, 0));
	await expect(page.getByRole('searchbox', { name: 'Search platforms' })).toBeFocused();
}

/** Both boundaries are observed; expected hashes are never substituted for browser state. */
export async function platformCheckpoint(page: Page) {
	const observed = await page
		.getByRole('searchbox', { name: 'Search platforms' })
		.evaluate((search: HTMLInputElement) => {
			return {
				route: location.pathname,
				query: search?.value ?? null,
				focus: document.activeElement === search ? 'Search platforms' : null,
				scroll: [scrollX, scrollY],
				viewport: [innerWidth, innerHeight]
			};
		});
	return videoSignature({ ...observed, role: 'fixture-reviewer', fixture });
}
export function expectedPlatformCheckpoint(viewport: { width: number; height: number }) {
	return videoSignature({
		route: platformRoute,
		query: '',
		focus: 'Search platforms',
		scroll: [0, 0],
		viewport: [viewport.width, viewport.height],
		role: 'fixture-reviewer',
		fixture
	});
}
export async function readyVideoMedia(page: Page) {
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
}
