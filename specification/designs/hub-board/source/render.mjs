/* global process, console */
// Renders every hub-board artboard to PNG in light and dark with headless Chromium (no window).
// Run from the repo root after `bun install`: node specification/designs/hub-board/source/render.mjs
// HB_PLAYWRIGHT names another Playwright module to import; HB_ONLY=<file prefix> renders a few.
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const canvas = join(here, '..', '..', '..', '..', 'designs', 'hub-board');
const out = join(here, '..', 'screens');
const { chromium } = await import(process.env.HB_PLAYWRIGHT ?? '@playwright/test');
const { artboards } = JSON.parse(readFileSync(join(canvas, 'canvas.json'), 'utf8'));
const only = process.env.HB_ONLY;

async function shoot(browser, file, theme) {
	const html = readFileSync(join(canvas, file), 'utf8');
	const [, width, height] = /artboard-size" content="(\d+)x(\d+)"/.exec(html).map(Number);
	const context = await browser.newContext({
		viewport: { width, height },
		deviceScaleFactor: 2,
		colorScheme: theme,
		javaScriptEnabled: false
	});
	const tab = await context.newPage();
	await tab.setContent(html.replace('<html>', `<html data-theme="${theme}">`), {
		waitUntil: 'load'
	});
	const path = join(out, `${file.slice(0, -5)}.${theme}.png`);
	await tab.screenshot({ path });
	await context.close();
	return path;
}

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
try {
	for (const { file } of artboards.filter((a) => !only || a.file.startsWith(only)))
		for (const theme of ['light', 'dark']) console.log(await shoot(browser, file, theme));
} finally {
	await browser.close();
}
