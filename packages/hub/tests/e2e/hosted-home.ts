import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';

/** The page the visitor reads: every color is measured as painted, whatever its CSS notation. */
export async function contrast(page: Page, text: Locator): Promise<number> {
	const handle = await text.elementHandle();
	return page.evaluate((element) => {
		const canvas = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
		const paint = (color: string) => {
			canvas.clearRect(0, 0, 1, 1);
			canvas.fillStyle = color;
			canvas.fillRect(0, 0, 1, 1);
			return [...canvas.getImageData(0, 0, 1, 1).data.slice(0, 3)];
		};
		const luminance = (rgb: number[]) => {
			const [r, g, b] = rgb.map((value) => {
				const channel = value / 255;
				return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
			});
			return 0.2126 * r + 0.7152 * g + 0.0722 * b;
		};
		const page = document.querySelector('.home-page')!;
		const fore = luminance(paint(getComputedStyle(element!).color));
		const back = luminance(paint(getComputedStyle(page).backgroundColor));
		return (Math.max(fore, back) + 0.05) / (Math.min(fore, back) + 0.05);
	}, handle);
}

/** How light the page background is, from 0 (black) to 1 (white). */
export async function backgroundLightness(page: Page): Promise<number> {
	return page.evaluate(() => {
		const canvas = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
		canvas.fillStyle = getComputedStyle(document.querySelector('.home-page')!).backgroundColor;
		canvas.fillRect(0, 0, 1, 1);
		const [r, g, b] = canvas.getImageData(0, 0, 1, 1).data;
		return (Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255;
	});
}

export async function box(locator: Locator) {
	const found = await locator.boundingBox();
	if (!found) throw new Error('The element is not rendered.');
	return found;
}

/** Proof captures are opt-in, so normal runs write nothing outside the test output. */
export async function capture(page: Page, name: string): Promise<void> {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const directory = process.env.SCREENSHOT_DIR ?? '/tmp/harness-hub-home';
	mkdirSync(directory, { recursive: true });
	await page.evaluate(() => document.fonts.ready);
	await page.screenshot({ path: join(directory, `${name}.png`), fullPage: true });
}

const pathIs = (path: string) => (url: URL) => url.pathname === path;

/**
 * Answers the Mac archive address as the Hub would: a published zip, a missing release, or an
 * HTML page served in its place. Returns the methods the page used to ask.
 */
export async function macRelease(page: Page, answer: 'zip' | 'missing' | 'page') {
	const asked: string[] = [];
	await page.route(pathIs('/downloads/Harness-mac-arm64.zip'), (route) => {
		asked.push(route.request().method());
		if (answer === 'zip')
			return route.fulfill({ status: 200, contentType: 'application/zip', body: '' });
		if (answer === 'missing')
			return route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found' });
		return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html>' });
	});
	return asked;
}

/**
 * Stands in for the /projects page the parent branch supplies, so the test proves only that the
 * homepage leads there. Returns each path the browser opened at that address.
 */
export async function projectsPage(page: Page) {
	const reached: string[] = [];
	await page.route(pathIs('/projects'), (route) => {
		reached.push(new URL(route.request().url()).pathname);
		const body = '<!doctype html><title>Projects</title><h1>Projects</h1>';
		return route.fulfill({ status: 200, contentType: 'text/html', body });
	});
	return reached;
}
