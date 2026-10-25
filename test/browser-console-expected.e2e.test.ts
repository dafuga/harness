import type { Spec, Execution } from './browser-console-expected.e2e.test.types';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { runCommand, runHarness } from './support/cli';

test('intentional errors retain diagnostics and cannot hide missing, duplicate or unrelated errors', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-expected-errors-'));
	try {
		await runHarness(['new', 'app', 'intentional'], root);
		const project = join(root, 'intentional');
		await symlink(resolve('node_modules'), join(project, 'node_modules'), 'dir');
		await runHarness(['generate', 'e2e', 'Expected'], project);
		const path = join(project, 'tests/e2e/expected-page.spec.ts');
		const imports = (await readFile(path, 'utf8')).split('\n')[0];
		await writeFile(path, imports + '\n' + flows);
		await writeFile(
			join(project, 'playwright.config.ts'),
			"export default { testDir: 'tests/e2e', testMatch: 'expected-page.spec.ts', workers: 1, reporter: 'json' };\n"
		);
		const result = await runCommand(
			['bun', resolve('node_modules/@playwright/test/cli.js'), 'test'],
			project,
			false,
			{ HARNESS_EVIDENCE_DIR: join(root, 'evidence') }
		);
		expect(result.exitCode).toBe(1);
		const results = JSON.parse(result.stdout).suites[0].specs.map((spec: Spec) => spec.tests[0]);
		expect(results.map((item: Execution) => item.status)).toEqual([
			'expected',
			'expected',
			'expected',
			'unexpected',
			'unexpected',
			'unexpected',
			'unexpected',
			'unexpected',
			'unexpected'
		]);
		expect(results[0].results[0].attachments).toEqual([]);
		const consoleLog = diagnostic(results[1]);
		expect(consoleLog.errors[0]).toMatchObject({
			type: 'console',
			message: 'expected failure',
			page: 'about:blank'
		});
		expect(consoleLog.expected[0].reason).toBe('Deliberately tests error handling.');
		expect(diagnostic(results[2]).errors[0].stack).toContain('expected exception');
		expect(diagnostic(results[4]).errors).toHaveLength(2);
		expect(diagnostic(results[5]).errors[0].message).toBe('error before assertion');
		expect(results[5].results[0].errors).toHaveLength(2);
		expect(diagnostic(results[7]).errors[0].message).toBe('manual context error');
		expect(diagnostic(results[8]).errors[0].message).toBe('unhandled rejection');
		await assertPersisted(results, root);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}, 120_000);

async function assertPersisted(results: Execution[], root: string) {
	expect(diagnostic(results[3])).toMatchObject({
		errors: [],
		expected: [expect.objectContaining({ message: 'expected failure' })]
	});
	const kept = (await readFile(join(root, 'evidence/browser-errors.ndjson'), 'utf8'))
		.trim()
		.split('\n')
		.map((line) => JSON.parse(line));
	expect(kept).toHaveLength(8);
	expect(kept.find((item) => item.test.includes('missing expected error'))).toMatchObject({
		errors: [],
		retry: 0,
		file: 'expected.spec.ts'
	});
}

test('API-only checks do not require a browser executable', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-api-only-'));
	try {
		await runHarness(['new', 'app', 'api-only'], root);
		const project = join(root, 'api-only');
		await symlink(resolve('node_modules'), join(project, 'node_modules'), 'dir');
		await runHarness(['generate', 'e2e', 'Api'], project);
		const path = join(project, 'tests/e2e/api-page.spec.ts');
		const imports = (await readFile(path, 'utf8')).split('\n')[0];
		await writeFile(
			path,
			imports +
				"\ntest('API context without Chromium', async ({ request }) => { expect((await request.storageState()).cookies).toEqual([]); });\n"
		);
		await writeFile(
			join(project, 'playwright.config.ts'),
			"export default { testDir: 'tests/e2e', testMatch: 'api-page.spec.ts', reporter: 'json', use: { launchOptions: { executablePath: '/nonexistent/harness-browser' } } };\n"
		);
		const result = await runCommand(
			['bun', resolve('node_modules/@playwright/test/cli.js'), 'test'],
			project,
			false
		);
		expect(result.exitCode, result.stdout).toBe(0);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}, 120_000);
function diagnostic(test: Execution) {
	const log = test.results[0].attachments.find((item) => item.name === 'browser-errors');
	expect(log).toBeDefined();
	return JSON.parse(Buffer.from(log!.body, 'base64').toString('utf8'));
}

const flows = `
const expected = { type: 'console', message: 'expected failure', reason: 'Deliberately tests error handling.' };
test('clean success is silent', async ({ page }) => {
 await page.setContent('<h1>Ready</h1>');
 await expect(page.getByRole('heading')).toHaveText('Ready');
});
test('intentional console error retains its log', async ({ page, browserErrors }) => {
 browserErrors.expectError(expected);
 await page.evaluate(() => console.error('expected failure'));
});
test('intentional exception retains its stack', async ({ page, browserErrors }) => {
 browserErrors.expectError({ type: 'pageerror', message: 'expected exception', reason: 'Tests uncaught exception diagnostics.' });
 const heard = page.waitForEvent('pageerror');
 await page.evaluate(() => { const script = document.createElement('script'); script.textContent = 'throw new Error("expected exception")'; document.body.append(script); });
 await heard;
});
test('missing expected error fails', async ({ browserErrors }) => {
 browserErrors.expectError(expected);
});
test('an additional copy is an unexpected error', async ({ page, browserErrors }) => {
 browserErrors.expectError(expected);
 await page.evaluate(() => { console.error('expected failure'); console.error('expected failure'); });
});
test('assertion failure keeps error diagnostics', async ({ page }) => {
 await page.evaluate(() => console.error('error before assertion'));
 expect(1).toBe(2);
});
test('a message from the wrong source is not expected', async ({ page, browserErrors }) => {
 browserErrors.expectError({ ...expected, source: 'https://other.test/script.js' });
 await page.evaluate(() => console.error('expected failure'));
});
test('manual contexts are watched explicitly', async ({ browser, browserErrors }) => {
 const other = await browser.newContext();
 browserErrors.watch(other);
 browserErrors.watch(other);
 const page = await other.newPage();
 await page.evaluate(() => console.error('manual context error'));
 await other.close();
});
test('unhandled rejections fail the normal flow', async ({ page }) => {
 const heard = page.waitForEvent('pageerror');
 await page.evaluate(() => { void Promise.reject(new Error('unhandled rejection')); });
 await heard;
});
`;
