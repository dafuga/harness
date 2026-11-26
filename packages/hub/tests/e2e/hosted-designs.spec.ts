import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from '../../../../test/support/browserTest';
import { DesignCanvasService } from '../../../../src/services/planning-collaboration/design-canvas-service/DesignCanvasService';
import { atlas, hostedFixture, tip } from './hosted-fixture';

/** The canvas committed in this repository, read the way the CLI reads it. */
const committed = new DesignCanvasService(resolve(import.meta.dirname, '../../../..')).read(
	'needs-you'
);
/** What a hand-edited artboard could try; the CLI refuses it, the viewer must contain it. */
const hostile = `<meta name="artboard-size" content="600x400">
<link rel="stylesheet" href="https://leak.test/link.css">
<link rel="preconnect" href="https://leak.test">
<meta http-equiv="refresh" content="0;url=https://leak.test/refresh">
<style>@import "https://leak.test/import.css"; body{background:url(https://leak.test/bg.png)}</style>
<script>top.document.title='owned';fetch('https://leak.test/fetch')</script>
<script src="https://leak.test/script.js"></script>
<img src="https://leak.test/img.png" onerror="document.body.dataset.ran='1'">
<iframe src="https://leak.test/frame"></iframe><object data="https://leak.test/object"></object>
<form action="https://leak.test/form"><button>Send</button></form>
<a href="https://leak.test/click" target="_top">A link</a><p id="seen">Hostile artboard</p>`;

const unset = (directive: string, fallback: string) =>
	`Note that '${directive}' was not explicitly set, so '${fallback}' is used as a fallback.`;
const blocked = (what: string, rule: string) =>
	`${what} violates the following Content Security Policy directive: "${rule}".`;
const image = (file: string) =>
	blocked(`Loading the image 'https://leak.test/${file}'`, 'img-src data:') +
	' The action has been blocked.';
const script =
	"Blocked script execution in 'about:srcdoc' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.";
/** What the browser says as it refuses the hostile artboard, once for each frame that shows it. */
const refusals = [
	script,
	script,
	script,
	image('img.png'),
	image('bg.png'),
	blocked("Loading the stylesheet 'https://leak.test/import.css'", "style-src 'unsafe-inline'") +
		` ${unset('style-src-elem', 'style-src')} The action has been blocked.`,
	blocked("Loading plugin data from 'https://leak.test/object'", "default-src 'none'") +
		` ${unset('object-src', 'default-src')} The action has been blocked.`,
	blocked("Framing 'https://leak.test/'", "default-src 'none'") +
		` The request has been blocked. ${unset('frame-src', 'default-src')}\n`
];

async function designs(page: Page, boards = committed.boards) {
	await hostedFixture(page);
	const asked: string[] = [];
	await page.route(`**/api/projects/${atlas}/designs**`, (route) => {
		asked.push(new URL(route.request().url()).search);
		return route.fulfill({
			json: {
				commit: tip,
				branch: 'feat/cards',
				branches: ['main', 'feat/cards'],
				canvases: [{ name: 'needs-you', title: committed.title, artboards: boards.length }],
				canvas: { ...committed, boards }
			}
		});
	});
	await page.goto(`/projects/${atlas}/designs/needs-you?branch=feat%2Fcards`);
	await expect(page.getByRole('application')).toBeVisible();
	return asked;
}

const board = (page: Page, name: string) =>
	page.getByRole('button', { name: new RegExp(`^${name}, \\d`) });
const zoom = async (page: Page) =>
	Number((await page.locator('.design-zoom').innerText()).replace('%', ''));
const world = (page: Page) => page.locator('.design-world').getAttribute('style');

async function shot(page: Page, info: TestInfo, name: string) {
	const folder = process.env.DESIGN_PROOF_DIR ?? info.outputDir;
	mkdirSync(folder, { recursive: true });
	await page.screenshot({ path: join(folder, `${name}.png`) });
}

test('artboards stand side by side; pan, zoom, select, open and theme work', async ({
	page
}, info) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.emulateMedia({ colorScheme: 'dark' });
	const asked = await designs(page);
	expect(asked[0]).toContain('branch=feat%2Fcards');
	await expect(page.locator('.design-board')).toHaveCount(committed.boards.length);
	const boxes = await page
		.locator('.design-board')
		.evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().toJSON()));
	boxes.slice(1).forEach((box, i) => expect(box.left).toBeGreaterThan(boxes[i].right));
	expect(boxes.at(-1)!.right).toBeLessThanOrEqual(1440);
	const frame = page.frameLocator('iframe[title="Home on desktop"]');
	await expect(frame.locator('html')).toHaveAttribute('data-theme', 'dark');
	await expect(frame.getByRole('heading', { name: /Needs you/ })).toBeVisible();
	await shot(page, info, 'canvas-desktop-dark');

	const fitted = await zoom(page);
	await page.getByRole('button', { name: 'Zoom in' }).click();
	expect(await zoom(page)).toBeGreaterThan(fitted);
	await page.getByRole('button', { name: 'Fit' }).click();
	expect(await zoom(page)).toBe(fitted);
	const stage = (await page.getByRole('application').boundingBox())!;
	await page.mouse.move(stage.x + 700, stage.y + 600);
	const before = await world(page);
	await page.mouse.wheel(0, 120);
	await expect.poll(() => world(page)).not.toBe(before);
	await page.keyboard.down('Control');
	await page.mouse.wheel(0, -40);
	await page.keyboard.up('Control');
	await expect.poll(() => zoom(page)).toBeGreaterThan(fitted);
	await page.getByRole('button', { name: 'Fit' }).click();

	const home = board(page, 'Home on desktop');
	const at = (await home.boundingBox())!;
	const still = await world(page);
	await page.mouse.move(at.x + 20, at.y + 20);
	await page.mouse.down();
	await page.mouse.move(at.x + 80, at.y + 90, { steps: 5 });
	await page.mouse.up();
	expect(await world(page)).not.toBe(still);
	await expect(home).toHaveAttribute('aria-pressed', 'false');
	await home.click();
	await expect(home).toHaveAttribute('aria-pressed', 'true');
	await shot(page, info, 'canvas-selected');

	await home.dblclick();
	const full = page.getByRole('dialog', { name: 'Home on desktop' });
	await expect(full).toBeVisible();
	await full.getByRole('button', { name: 'Actual size' }).click();
	await expect(full).toContainText('1440×900 · 100%');
	await shot(page, info, 'artboard-full');
	await page.keyboard.press('Escape');
	await expect(full).toHaveCount(0);
	await board(page, 'Other modal on desktop').focus();
	await page.keyboard.press('Enter');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('dialog', { name: 'Other modal on desktop' })).toBeVisible();
	await page.getByRole('button', { name: 'Close' }).click();

	await page.getByRole('button', { name: 'Dark' }).click();
	await expect(frame.locator('html')).toHaveAttribute('data-theme', 'light');
	await shot(page, info, 'canvas-desktop-light');
});

test('a phone shows the canvas and opens the selected artboard', async ({ page }, info) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ colorScheme: 'light' });
	await designs(page);
	await shot(page, info, 'canvas-phone-light');
	await board(page, 'Home on iPhone').click();
	await page.getByRole('button', { name: 'Open', exact: true }).click();
	const full = page.getByRole('dialog', { name: 'Home on iPhone' });
	await expect(full).toBeVisible();
	await expect(full.frameLocator('iframe').getByRole('heading', { name: /Needs/ })).toBeVisible();
	const painted = (await full.locator('iframe').boundingBox())!;
	expect(painted.x).toBeGreaterThanOrEqual(0);
	expect(painted.y).toBeGreaterThan(40);
	expect(painted.x + painted.width).toBeLessThanOrEqual(391);
	await page.waitForTimeout(500);
	await shot(page, info, 'artboard-phone-full');
	const wide = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(wide).toBeLessThanOrEqual(390);
});

test('a hostile artboard runs nothing, loads nothing and cannot leave its frame', async ({
	page,
	context,
	browserErrors
}, info) => {
	for (const message of [...refusals, ...refusals])
		browserErrors.expectError({
			type: 'console',
			message,
			reason: 'The sandbox and policy refusing the hostile artboard is what this proves.'
		});
	const leaked: string[] = [];
	await context.route(/leak\.test/, (route) => {
		leaked.push(route.request().url());
		return route.abort();
	});
	// An attempt the policy stops is reported and fails as "csp" before any network is used.
	page.on('response', (r) => r.url().includes('leak.test') && leaked.push(r.url()));
	const failures = new Set<string>();
	page.on('requestfailed', (r) => {
		if (r.url().includes('leak.test')) failures.add(r.failure()?.errorText ?? '');
	});
	const bad = { ...committed.boards[0], file: 'Bad.html', title: 'Hostile', html: hostile };
	await designs(page, [{ ...bad, width: 600, height: 400, x: 0, y: 0 }]);
	const element = page.locator('iframe[title="Hostile"]');
	await expect(element).toHaveAttribute('sandbox', '');
	const frame = page.frameLocator('iframe[title="Hostile"]');
	await expect(frame.locator('#seen')).toBeVisible();
	await board(page, 'Hostile').dblclick();
	// A click where the link is drawn lands on the viewer, never in the artboard.
	const shown = page.getByRole('dialog').locator('iframe');
	const box = (await shown.boundingBox())!;
	await page.mouse.click(box.x + 20, box.y + box.height / 2);
	await page.keyboard.press('Tab');
	await page.keyboard.press('Tab');
	await page.waitForTimeout(750);
	await expect(frame.first().locator('#seen')).toBeAttached();
	await expect(frame.first().locator('body')).not.toHaveAttribute('data-ran', '1');
	expect(await page.title()).toBe('Harness · Designs');
	expect(page.url()).toContain('/designs/needs-you');
	expect(leaked).toEqual([]);
	expect([...failures]).toEqual(['csp']);
	await shot(page, info, 'hostile-contained');
});
