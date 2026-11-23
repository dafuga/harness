import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import type { MockupCapture } from '../../src/utils/planning-collaboration/mockupSource.types';
import { mockupHtml } from '../../src/utils/planning-collaboration/mockupSource';
import { expect, type Page } from '../../../../test/support/browserTest';

import { fixture } from './ui-design-fixture';

const sizes = [
	{ width: 390, height: 844 },
	{ width: 834, height: 1194 },
	{ width: 1024, height: 900 },
	{ width: 1440, height: 900 },
	{ width: 1920, height: 1080 }
];
const style = `
	* { box-sizing: border-box }
	body { margin: 0; padding: clamp(20px, 5vw, 88px); font: 16px/1.5 system-ui; color: #204154; background: #f1f5f6 }
	h1 { margin-top: 0; font-size: clamp(38px, 6vw, 86px); letter-spacing: -.06em }
	main { max-width: 950px; margin: auto }
	article { margin: 14px 0; padding: 1rem; border: 1px solid #b7ced7; border-radius: 12px; background: white }
	.after { color: #183839 }
	.after section { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(250px, 100%), 1fr)); gap: 14px }
	.after article { border-top: 5px solid #31847c; background: #f8fffc; margin: 0 }
	nav { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 26px; font-weight: 650 }
`;
function comparison(title: string, after: boolean) {
	return mockupHtml(
		{
			html: `<main class="${after ? 'after' : 'before'}"><h1>Activity</h1><nav>All activity · My work · Filters</nav><section>
			<article><strong>${title}</strong><p>Project updates from this week</p></article>
			<article><strong>Verification</strong><p>Checks ready for review</p></article>
			<article><strong>Design proposals</strong><p>Plans with open feedback</p></article>
		</section></main>`,
			css: style
		},
		''
	);
}

// Compile with the same options as Electron main, then exercise the external package under Node.
async function packagedCaptures(captures: MockupCapture[]) {
	const directory = await mkdtemp(join(process.cwd(), '.mockup-node-'));
	try {
		execFileSync(
			'bun',
			[
				'-e',
				`
import { desktopNodeOptions } from './scripts/build-main.ts';
const result = await Bun.build({
	...desktopNodeOptions, entrypoints: ['src/utils/planning-collaboration/mockupCapture.ts'],
	outdir: process.argv[1], naming: 'capture.cjs'
});
if (!result.success) throw new Error(result.logs.map(String).join('\\n'));
`,
				directory
			],
			{ stdio: 'pipe' }
		);
		execFileSync(
			process.execPath,
			[
				'-e',
				`
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const directory = process.argv[1];
const { mockupCapture } = require(join(directory, 'capture.cjs'));
const captures = JSON.parse(readFileSync(0, 'utf8'));
mockupCapture(captures, AbortSignal.timeout(90000)).then(
	pngs => pngs.forEach((png, at) => writeFileSync(join(directory, at + '.png'), png)),
	error => { console.error(error); process.exitCode = 1; }
);
`,
				directory
			],
			{ input: JSON.stringify(captures), timeout: 100000 }
		);
		return await Promise.all(captures.map((_, at) => readFile(join(directory, at + '.png'))));
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

async function planFixtureCaptures() {
	const captures: MockupCapture[] = sizes.flatMap((viewport) => [
		{
			viewport,
			option: 0,
			state: 'default',
			scheme: 'light',
			html: comparison('Recent work', true)
		},
		{
			viewport,
			option: 0,
			state: 'before-default',
			scheme: 'light',
			html: comparison('Recent work', false)
		},
		{
			viewport,
			option: 0,
			state: 'busy',
			scheme: 'light',
			html: comparison('Refreshing activity', true)
		},
		{
			viewport,
			option: 0,
			state: 'before-busy',
			scheme: 'light',
			html: comparison('Refreshing activity', false)
		}
	]);
	const bytes = await packagedCaptures(captures);
	return bytes.map((buffer, index) => {
		const png = Buffer.from(buffer);
		const { width, height } = PNG.sync.read(png);
		const capture = captures[index];
		expect({ width, height }).toEqual(capture.viewport);
		return {
			state: capture.state,
			viewport: `width-${width}`,
			sha256: createHash('sha256').update(png).digest('hex'),
			png: Array.from(png)
		};
	});
}

export async function viewPlanMockup(
	page: Page,
	checkpoint: (page: Page, name: string) => Promise<void>
) {
	await fixture(page, false, await planFixtureCaptures());
	await page.goto('/');
	await page.getByRole('button', { name: 'Open project', exact: true }).click();
	await page.getByRole('link', { name: 'Open Activity', exact: true }).click();
	const tabs = page.getByRole('navigation', { name: 'Entity sections' });
	await tabs.getByRole('button', { name: 'Overview', exact: true }).click();
	const panel = page.locator('.design-panel');
	if (process.env.SCREENSHOT_LABEL === 'before')
		await checkpoint(page, 'planned-design-overview-before');
	await expect(panel.getByRole('heading', { name: 'Planned design', exact: true })).toBeVisible();
	const widths = [
		['Phone · 390px', 390],
		['Tablet · 834px', 834],
		['1024px', 1024],
		['Laptop · 1440px', 1440],
		['Wide · 1920px', 1920]
	] as const;
	await expect(panel.getByRole('group', { name: 'Viewport' }).getByRole('button')).toHaveText(
		widths.map(([label]) => label)
	);
	for (const [name, width] of widths) {
		await panel.getByRole('button', { name, exact: true }).click();
		const before = panel.getByRole('img', { name: `Activity current ${name} default` });
		const after = panel.getByRole('img', { name: `Activity v002 ${name} default` });
		const measure = (image: HTMLImageElement) => image.decode().then(() => image.naturalWidth);
		expect(await before.evaluate(measure)).toBe(width);
		expect(await after.evaluate(measure)).toBe(width);
	}
	await panel.getByRole('button', { name: 'Laptop · 1440px', exact: true }).click();
	await expect(panel.getByRole('img', { name: /v002 Laptop .* default/ })).toBeVisible();
	await checkpoint(page, 'planned-design-laptop');
	await panel.getByRole('button', { name: 'Wide · 1920px', exact: true }).click();
	const state = panel.getByRole('group', { name: 'Image state' });
	await state.getByRole('button', { name: 'busy' }).click();
	await expect(panel.getByRole('img', { name: /current .* busy/ })).toBeVisible();
	await page.setViewportSize({ width: 1920, height: 1080 });
	await checkpoint(page, 'planned-design-wide');
	await page.getByRole('button', { name: 'Close conversation', exact: true }).click();
	await page.setViewportSize({ width: 834, height: 1194 });
	await panel.getByRole('button', { name: 'Tablet · 834px', exact: true }).click();
	await expect(panel.getByRole('img', { name: /current Tablet .* busy/ })).toBeVisible();
	await checkpoint(page, 'planned-design-tablet');
	await page.setViewportSize({ width: 390, height: 844 });
	await panel.getByRole('button', { name: 'Phone · 390px', exact: true }).click();
	await expect(panel.getByRole('img', { name: /current Phone .* busy/ })).toBeVisible();
	await expect(panel.getByRole('img', { name: /v002 Phone .* busy/ })).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
	await checkpoint(page, 'planned-design-phone');
	await tabs.getByRole('button', { name: 'Designs', exact: true }).click();
	await expect(page.getByLabel('Design version', { exact: true })).toBeVisible();
}
