import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { runCommand, runHarness } from './support/cli';

test('generated browser tests reject errors in normal flows and pass after the error disappears', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-browser-errors-'));
	try {
		await runHarness(['new', 'app', 'browser-proof'], root);
		const project = join(root, 'browser-proof');
		await symlink(resolve('node_modules'), join(project, 'node_modules'), 'dir');
		await runHarness(['generate', 'e2e', 'Dashboard'], project);
		const spec = join(project, 'tests/e2e/dashboard.spec.ts');
		const imports = (await readFile(spec, 'utf8')).split('\n')[0];
		await writeFile(join(project, 'playwright.config.ts'), config);
		await writeFile(spec, normalFlows(imports));
		const result = await browserRun(project);
		expect(result.exitCode).toBe(1);
		const report = JSON.parse(result.stdout);
		expect(outcomes(report)).toEqual([
			'expected',
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
				.replace('throw new Error', 'console.info')
		);
		const repaired = await browserRun(project);
		expect(repaired.exitCode).toBe(0);
		expect(outcomes(JSON.parse(repaired.stdout))).toEqual(Array(5).fill('expected'));
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}, 120_000);

const config = `import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: 'tests/e2e', workers: 1, reporter: 'json' });
`;

function normalFlows(imports: string): string {
	return `${imports}
test('normal success', async ({ page }) => {
 await page.setContent('<h1>Ready</h1>');
 await page.evaluate(() => { console.info('information'); console.warn('warning'); });
 await expect(page.getByRole('heading')).toHaveText('Ready');
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
