/* global process, console */
// Renders the Sign in with Google mockup to PNG with headless Chromium (no window opens).
// Run from the repo root after `bun install`: node specification/designs/desktop-home/render.mjs
// The home screens are captured from the real app; see README.md.
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(process.env.DH_PLAYWRIGHT ?? '@playwright/test');
const page = pathToFileURL(join(here, 'mockup', 'sign-in.html')).href;
const sizes = {
	phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
	tablet: { viewport: { width: 834, height: 1112 }, deviceScaleFactor: 1 },
	laptop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }
};
const browser = await chromium.launch();
try {
	for (const [size, options] of Object.entries(sizes)) {
		const context = await browser.newContext({ ...options, colorScheme: 'dark' });
		const tab = await context.newPage();
		for (const state of ['default', 'waiting', 'error']) {
			await tab.goto(`${page}?state=${state}`);
			const path = join(here, 'screens', `sign-in--${state}--${size}.png`);
			await tab.screenshot({ path });
			console.log(path);
		}
		await context.close();
	}
} finally {
	await browser.close();
}
