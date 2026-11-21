/* global process, console, document */
// Renders every Hub home mockup screen to PNG with headless Chromium (no window opens).
// Run from the repo root after `bun install`: node specification/designs/hub-home/render.mjs
// HH_PLAYWRIGHT names another Playwright module to import; HH_ONLY=<screen> renders one screen.
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(process.env.HH_PLAYWRIGHT ?? '@playwright/test');
const page = pathToFileURL(join(here, 'mockup', 'index.html')).href;
const sizes = {
	phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
	tablet: { viewport: { width: 834, height: 1194 }, deviceScaleFactor: 1 },
	laptop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
	wide: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }
};
const modals = ['agents', 'plans', 'scheduled', 'projects', 'wip', 'wip-projects'];
const states = ['busy', 'empty', 'loading'];
const schemes = ['dark', 'light'];

/** Every capture: [screen, state, scheme, size, full]. */
function captures() {
	const list = [];
	for (const size of Object.keys(sizes)) {
		for (const scheme of schemes) {
			for (const state of ['default', ...states]) list.push(['root', state, scheme, size, true]);
			for (const screen of modals) list.push([screen, 'default', scheme, size, false]);
		}
	}
	list.push(
		['agent-chat', 'default', 'dark', 'phone', false],
		['agent-chat', 'default', 'light', 'phone', false]
	);
	for (const size of ['phone', 'laptop']) {
		for (const screen of modals) {
			for (const state of states) list.push([screen, state, 'dark', size, false]);
			list.push([screen, 'default', 'dark', size, true]);
		}
	}
	const only = process.env.HH_ONLY;
	return only ? list.filter(([screen]) => screen === only) : list;
}

async function capture(browser, [screen, state, scheme, size, full]) {
	const context = await browser.newContext({
		...sizes[size],
		colorScheme: scheme,
		reducedMotion: 'reduce'
	});
	const tab = await context.newPage();
	await tab.goto(`${page}?screen=${screen}&state=${state}`);
	const fullModal = full && screen !== 'root';
	if (fullModal) await tab.evaluate(() => document.querySelector('#app').classList.add('hh-full'));
	const name = `${screen}--${state}--${scheme}${fullModal ? '--full' : ''}.png`;
	const out = join(here, 'screens', size, name);
	await mkdir(dirname(out), { recursive: true });
	await tab.screenshot({ path: out, fullPage: full, animations: 'disabled' });
	await context.close();
	return out;
}

const browser = await chromium.launch({ headless: true });
const list = captures();
for (const item of list) await capture(browser, item);
await browser.close();
console.log(`Rendered ${list.length} screens into ${join(here, 'screens')}`);
