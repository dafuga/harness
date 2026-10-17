import { browserEvidence } from '../../../../test/support/browserEvidence';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '../../../../test/support/browserTest';
import { buildShellFixture, openShellPage, removeShellFixture } from './support/shellFixture';

let home = '';
test.beforeAll(() => {
	home = buildShellFixture(['errors']);
});
test.afterAll(() => removeShellFixture(home));
for (const width of [1440, 390]) {
	test(`component Tests show expected and missing browser errors at ${width}px`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height: 1000 });
		await openShellPage(page, home, 'errors');
		await expect(page.getByRole('heading', { name: 'Verification at ccccccc' })).toBeVisible();
		const logs = page.getByRole('group', { name: 'Browser errors' });
		if (await logs.count()) await logs.locator('summary').click();
		if (process.env.TAKE_SCREENSHOT === 'true') {
			await page.evaluate(() => document.fonts.ready);
			await page.mouse.move(0, 0);
			const directory = resolve(
				'../../work/browser-error-evidence',
				process.env.SCREENSHOT_LABEL ?? 'local'
			);
			await mkdir(directory, { recursive: true });
			await page.screenshot({ path: `${directory}/console-${width}.png`, fullPage: true });
		}
		await browserEvidence(page, { state: 'console', home });
		await expect(logs).toBeVisible();
		await expect(logs).toContainText('Orders › failed request');
		await expect(logs.getByText('Expected', { exact: true })).toHaveCount(1);
		await expect(logs.getByText('Missing expected error', { exact: true })).toHaveCount(1);
		await expect(logs).toContainText('Tests the retry state.');
		await expect(logs).toContainText('Retry exhausted');
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
			true
		);
	});
}
