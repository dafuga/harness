import { expect, test } from '../../../../test/support/browserTest';
import { branch, commits, evidenceFixture, ids, sharedProject } from './ui-evidence-fixture';
import type { Page, TestInfo } from '@playwright/test';

/** Test-owned screenshots; synthetic source sessions are not sealed runtime scenario evidence. */
async function sourceScreenshot(page: Page, info: TestInfo, phase: string) {
	if (!process.env.TAKE_SCREENSHOT) return;
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
	await page.mouse.move(0, 0);
	await info.attach(`source-${phase}`, {
		body: await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' }),
		contentType: 'image/png'
	});
}

const first = 'src/functions/filterOrders.ts';
const second = 'src/functions/Order types #é.ts';
async function sourceFixture(page: Page) {
	await evidenceFixture(page, { sources: { [ids.filter]: [first, second] } });
}
async function linkedFiles(page: Page, commit: string) {
	const files = page.getByRole('list', { name: 'Source files', exact: true });
	for (const path of [first, second]) {
		const link = files.getByRole('link', { name: path, exact: true });
		await expect(link).toHaveAttribute(
			'href',
			`https://github.com/fixture/orders/blob/${commit}/${path.split('/').map(encodeURIComponent).join('/')}`
		);
		await expect(link).toHaveAttribute('target', '_blank');
		await expect(
			link.locator('..').getByRole('button', { name: `View code for ${path}`, exact: true })
		).toBeVisible();
	}
}
async function historicalFile(page: Page, root: string) {
	await page.goto(`${root}/commit/${commits.middle}/functions/${ids.filter}/source`);
	await linkedFiles(page, commits.middle);
	await page.getByRole('button', { name: `View code for ${first}`, exact: true }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.locator('pre')).toContainText(first);
	await expect(dialog.getByText(commits.middle.slice(0, 7), { exact: true })).toBeVisible();
}

for (const width of [1440, 920, 390]) {
	test(`only the detail Source tab opens code at the selected revision at ${width}px`, async ({
		page
	}, info) => {
		await page.setViewportSize({ width, height: 900 });
		await sourceFixture(page);
		const root = `/projects/${sharedProject}/harness/branch/${encodeURIComponent(branch)}`;
		await page.goto(`${root}/functions`);
		await sourceScreenshot(page, info, 'catalog');
		await expect(page.getByRole('button', { name: /^View code for / })).toHaveCount(0);
		await page.getByRole('link', { name: 'Open filterOrders', exact: true }).click();
		await expect(page.getByRole('button', { name: /^View code for / })).toHaveCount(0);
		await page.getByRole('button', { name: 'Source', exact: true }).click();
		const button = page.getByRole('button', { name: `View code for ${second}`, exact: true });
		await expect(
			page.locator('.entity-heading').getByRole('button', { name: /^View code for / })
		).toHaveCount(0);
		await expect(page.locator('pre')).toHaveCount(0);
		await sourceScreenshot(page, info, 'action');
		await linkedFiles(page, commits.tip);
		const address = page.url();
		await button.click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();
		await expect(dialog.locator('pre')).toContainText(second);
		await expect(dialog.getByRole('combobox', { name: 'Source file' })).toHaveValue(second);
		await expect(dialog.getByText(commits.tip.slice(0, 7), { exact: true })).toBeVisible();
		await sourceScreenshot(page, info, 'modal');
		await page.keyboard.press('Escape');
		await expect(dialog).toHaveCount(0);
		await expect(button).toBeFocused();
		expect(page.url()).toBe(address);
		await page.getByRole('button', { name: 'Overview', exact: true }).click();
		await expect(page.getByRole('button', { name: /^View code for / })).toHaveCount(0);
		await historicalFile(page, root);
	});
}

test('a source refusal is explicit and leaves no previous code visible', async ({ page }) => {
	await sourceFixture(page);
	await page.goto(
		`/projects/${sharedProject}/harness/branch/${encodeURIComponent(branch)}/functions/${ids.filter}/source`
	);
	await page.evaluate(() => {
		const host = window as unknown as { harness: { source: () => Promise<unknown> } };
		host.harness.source = async () => {
			throw new Error('Source refused for this revision.');
		};
	});
	await page.getByRole('button', { name: `View code for ${first}`, exact: true }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByRole('alert')).toHaveText('Source refused for this revision.');
	await expect(dialog.locator('pre')).toHaveCount(0);
});
