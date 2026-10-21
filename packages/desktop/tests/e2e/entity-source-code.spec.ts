import { expect, test } from '../../../../test/support/browserTest';
import { branch, commits, evidenceFixture, ids, sharedProject } from './ui-evidence-fixture';
import { runtimeEvidence } from './runtime-evidence';

for (const width of [1440, 920, 390]) {
	test(`catalog and detail source use the selected revision at ${width}px`, async ({
		page
	}, info) => {
		await page.setViewportSize({ width, height: 900 });
		await evidenceFixture(page);
		const root = `/projects/${sharedProject}/harness/branch/${encodeURIComponent(branch)}`;
		await page.goto(`${root}/functions`);
		const button = page.getByRole('button', { name: 'View code for filterOrders', exact: true });
		await runtimeEvidence(page, info, 'source-action');
		await expect(button).toBeVisible();
		const address = page.url();
		await button.click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();
		await expect(dialog.locator('pre')).toContainText('export {};');
		await expect(dialog.getByText(commits.tip.slice(0, 7), { exact: true })).toBeVisible();
		await runtimeEvidence(page, info, 'source-modal');
		await page.keyboard.press('Escape');
		await expect(dialog).toHaveCount(0);
		await expect(button).toBeFocused();
		expect(page.url()).toBe(address);
		await page.goto(`${root}/commit/${commits.middle}/functions/${ids.filter}`);
		await page.getByRole('button', { name: 'View code for Filter orders', exact: true }).click();
		await expect(dialog.locator('pre')).toContainText('export {};');
		await expect(dialog.getByText(commits.middle.slice(0, 7), { exact: true })).toBeVisible();
	});
}

test('a source refusal is explicit and leaves no previous code visible', async ({ page }) => {
	await evidenceFixture(page);
	await page.goto(
		`/projects/${sharedProject}/harness/branch/${encodeURIComponent(branch)}/functions`
	);
	await page.evaluate(() => {
		const host = window as unknown as { harness: { source: () => Promise<unknown> } };
		host.harness.source = async () => {
			throw new Error('Source refused for this revision.');
		};
	});
	await page.getByRole('button', { name: 'View code for filterOrders', exact: true }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByRole('alert')).toHaveText('Source refused for this revision.');
	await expect(dialog.locator('pre')).toHaveCount(0);
});
