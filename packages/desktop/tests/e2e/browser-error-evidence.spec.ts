import { browserEvidence } from '../../../../test/support/browserEvidence';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '../../../../test/support/browserTest';
import { branch, commits, evidenceFixture, ids, sharedProject } from './ui-evidence-fixture';

const address = `/projects/${sharedProject}/harness/branch/${encodeURIComponent(branch)}/components/${ids.list}/evidence`;
const browserErrors = [
	{
		test: 'Orders › request failure and recovery',
		file: 'orders.spec.ts',
		project: 'chromium',
		retry: 1,
		browser: 'chromium',
		errors: [
			{
				type: 'console',
				message: 'Orders unavailable',
				page: 'https://fixture.test/orders',
				source: 'https://fixture.test/orders.js',
				line: 19,
				column: 4
			},
			{ type: 'console', message: 'Orders unavailable', page: 'https://fixture.test/orders' },
			{
				type: 'pageerror',
				message: 'Cannot render orders',
				page: 'https://fixture.test/orders',
				stack: 'Error: Cannot render orders\n at render (orders.js:24:5)'
			}
		],
		expected: [
			{
				type: 'console',
				message: 'Orders unavailable',
				reason: 'The server returns 503 to exercise retry.'
			},
			{ type: 'console', message: 'Retry exhausted', reason: 'The exhausted retry must be logged.' }
		]
	}
];

for (const width of [1440, 390]) {
	test(`component evidence shows browser errors with their expectations at ${width}px`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height: 1000 });
		await evidenceFixture(page, { shared: true, observedUnits: [ids.list], browserErrors });
		await page.goto(address);
		await page.getByText('Verification details', { exact: true }).click();
		const coverage = page.getByRole('region', { name: 'Evidence coverage' });
		await expect(
			coverage.getByRole('heading', { name: /Search across synthetic orders/ }).first()
		).toBeVisible();
		// Capture the same checkpoint before asserting so the unchanged application has red pixels.
		const logs = coverage.getByRole('group', { name: 'Browser errors' });
		if (await logs.count()) await logs.locator('summary').first().click();
		if (process.env.TAKE_SCREENSHOT === 'true') {
			await page.evaluate(() => document.fonts.ready);
			await page.mouse.move(0, 0);
			const directory = resolve(
				'../../work/browser-error-evidence',
				process.env.SCREENSHOT_LABEL ?? 'local'
			);
			await mkdir(directory, { recursive: true });
			await page.screenshot({ path: `${directory}/desktop-${width}.png`, fullPage: true });
		}
		await browserEvidence(page, { state: 'desktop' });
		await expect(logs).toBeVisible();
		await expect(logs).toContainText('Orders › request failure and recovery');
		await expect(logs).toContainText('Retry 1');
		await expect(logs.getByText('Expected', { exact: true })).toHaveCount(1);
		await expect(logs.getByText('Unexpected', { exact: true })).toHaveCount(2);
		await expect(logs.getByText('Missing expected error', { exact: true })).toHaveCount(1);
		await expect(logs).toContainText('The server returns 503 to exercise retry.');
		await expect(logs).toContainText('Retry exhausted');
		await expect(logs).toContainText('orders.js:20:5');
		await expect(logs).toContainText('at render (orders.js:24:5)');
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
			true
		);
		await page.goto(address.replace('/components/', `/commit/${commits.first}/components/`));
		await page.getByText('Verification details', { exact: true }).click();
		await expect(page.getByRole('region', { name: 'Evidence coverage' })).toBeVisible();
		await expect(page.getByRole('group', { name: 'Browser errors' })).toHaveCount(0);
	});
}
