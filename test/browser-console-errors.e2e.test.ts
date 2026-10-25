import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { png } from './support/legacyStore';
import { runCommand, runHarness } from './support/cli';

test('generated browser tests reject errors in normal flows and pass after the error disappears', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-browser-errors-'));
	try {
		await runHarness(['new', 'app', 'browser-proof'], root);
		const project = join(root, 'browser-proof');
		await symlink(resolve('node_modules'), join(project, 'node_modules'), 'dir');
		await runHarness(['generate', 'e2e', 'Dashboard'], project);
		const spec = join(project, 'tests/e2e/dashboard-page.spec.ts');
		const imports = (await readFile(spec, 'utf8')).split('\n')[0];
		await writeFile(join(project, 'playwright.config.ts'), config);
		await mkdir(join(project, 'tests/e2e/reviewed'), { recursive: true });
		await writeFile(join(project, 'tests/e2e/reviewed/solid-gray.png'), png(128));
		await writeFile(spec, normalFlows(imports));
		const result = await browserRun(project);
		expect(result.exitCode).toBe(1);
		const report = JSON.parse(result.stdout);
		expect(outcomes(report)).toEqual([
			'expected',
			'unexpected',
			'unexpected',
			'unexpected',
			'unexpected',
			'unexpected'
		]);
		for (const item of report.suites[0].specs.slice(1)) {
			const execution = item.tests[0].results[0];
			expect(
				execution.attachments.some((item: { name: string }) => item.name === 'browser-errors')
			).toBe(true);
			expect(execution.errors[0].message).toContain('Unexpected browser errors');
		}
		await writeFile(
			spec,
			normalFlows(imports)
				.replaceAll('console.error', 'console.info')
				.replaceAll('throw new Error', 'console.info')
		);
		const repaired = await browserRun(project);
		expect(repaired.exitCode).toBe(0);
		expect(outcomes(JSON.parse(repaired.stdout))).toEqual(Array(6).fill('expected'));
		await assertScreenshotFailures(
			project,
			spec,
			normalFlows(imports)
				.replaceAll('console.error', 'console.info')
				.replaceAll('throw new Error', 'console.info')
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}, 120_000);

const config = `import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: 'tests/e2e', testMatch: 'dashboard-page.spec.ts', updateSnapshots: 'none', snapshotPathTemplate: '{testDir}/reviewed/{arg}{ext}', workers: 1, reporter: 'json' });
`;

function normalFlows(imports: string): string {
	return `${imports}
test('normal success', async ({ page, matchScreenshot }) => {
 await page.setContent('<h1>Ready</h1>');
 await page.evaluate(() => { console.info('information'); console.warn('warning'); });
 await expect(page.getByRole('heading')).toHaveText('Ready');
 await page.setViewportSize({ width: 4, height: 4 });
 await page.setContent('<body style="margin:0;background:#808080"><div data-testid="tile" style="width:4px;height:4px"></div></body>');
 await matchScreenshot(page, 'solid-gray.png');
 await matchScreenshot(page.getByTestId('tile'), 'solid-gray.png');
});
test('console error during navigation', async ({ page }) => {
 await page.route('https://harness.test/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Ready</h1><script>console.error("navigation failed")</script>' }));
 await page.goto('https://harness.test/');
 await expect(page.getByRole('heading')).toHaveText('Ready');
});
test('uncaught exception', async ({ page }) => {
 await page.setContent('<h1>Ready</h1>');
 await page.evaluate(() => { const script = document.createElement('script'); script.textContent = 'throw new Error("uncaught failure")'; document.body.append(script); });
 await expect(page.getByRole('heading')).toHaveText('Ready');
});
test('additional page error', async ({ context }) => {
 const popup = await context.newPage();
 await popup.setContent('<h1>Popup ready</h1>');
 await popup.evaluate(() => console.error('popup failure'));
 await expect(popup.getByRole('heading')).toHaveText('Popup ready');
 await popup.close();
});
test('popup navigation error', async ({ page, context }) => {
 await context.route('https://popup.harness.test/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Popup ready</h1><script>console.error("popup navigation failed")</script>' }));
 const opened = page.waitForEvent('popup');
 await page.evaluate(() => { window.open('https://popup.harness.test/'); });
 const popup = await opened;
 await expect(popup.getByRole('heading')).toHaveText('Popup ready');
 await popup.close();
});
test('popup navigation exception', async ({ page, context }) => {
 await context.route('https://popup.harness.test/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Popup ready</h1><script>throw new Error("popup exception")</script>' }));
 const opened = page.waitForEvent('popup');
 await page.evaluate(() => { window.open('https://popup.harness.test/'); });
 const popup = await opened;
 await expect(popup.getByRole('heading')).toHaveText('Popup ready');
 await popup.close();
});
`;
}

function browserRun(project: string) {
	return runCommand(
		['bun', resolve('node_modules/@playwright/test/cli.js'), 'test'],
		project,
		false
	);
}

function outcomes(report: { suites: { specs: { tests: { status: string }[] }[] }[] }): string[] {
	return report.suites[0].specs.map((spec) => spec.tests[0].status);
}

async function assertScreenshotFailures(project: string, spec: string, repaired: string) {
	for (const changed of [
		repaired.replace('background:#808080', 'background:#000000'),
		repaired.replace(
			"await matchScreenshot(page.getByTestId('tile')",
			"await page.getByTestId('tile').evaluate((element) => element.style.backgroundColor = '#000000');\n await matchScreenshot(page.getByTestId('tile')"
		)
	]) {
		await writeFile(spec, changed);
		const result = await browserRun(project);
		expect(result.exitCode).toBe(1);
		expect(outcomes(JSON.parse(result.stdout))).toEqual([
			'unexpected',
			...Array(5).fill('expected')
		]);
		expect(result.stdout).toContain('toHaveScreenshot');
	}
	await writeFile(spec, repaired);
	await rm(join(project, 'tests/e2e/reviewed/solid-gray.png'));
	const missing = await browserRun(project);
	expect(missing.exitCode).toBe(1);
	await expect(readFile(join(project, 'tests/e2e/reviewed/solid-gray.png'))).rejects.toThrow(
		'ENOENT'
	);
	await writeFile(join(project, 'tests/e2e/reviewed/solid-gray.png'), png(128));
	expect((await browserRun(project)).exitCode).toBe(0);
}
