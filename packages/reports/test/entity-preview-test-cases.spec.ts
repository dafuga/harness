import { expect, test } from '../../../test/support/browserTest';
import { capture, fits, open, viewports } from './entityPreviewPage';
import { commits, ids } from './entityUnits';

const entity = { category: 'services' as const, entity: ids.store, tab: 'tests' as const };

for (const [viewport, size] of Object.entries(viewports)) {
	test(`service Tests show recorded input and output at ${viewport} width`, async ({ page }) => {
		await page.setViewportSize(size);
		await open(page, entity);
		const pane = page.getByRole('tabpanel', { name: 'Order store tests' });
		await expect(pane.getByRole('heading', { name: 'Current end-to-end behavior' })).toBeVisible();
		await expect(pane.getByRole('status').filter({ hasText: 'Current behavior' })).toBeVisible();
		await capture(page, `${process.env.SCREENSHOT_LABEL ?? 'run'}-tests-current-${viewport}`);
		const table = pane.getByRole('table').filter({ hasText: 'Test observation' }).first();
		await expect(table.getByRole('columnheader')).toHaveText(['Case', 'Input', 'Observed output']);
		await expect(table).toContainText('SERVICE');
		await expect(table).toContainText('Order 1042 · Service call');
		await expect(pane).not.toContainText('Actual output');
		expect(await fits(page)).toBe(true);
	});
}

test('service Tests keep parent and selected-commit cases separate', async ({ page }) => {
	await open(page, { ...entity, commit: commits.middle });
	const pane = page.getByRole('tabpanel', { name: 'Order store tests' });
	await expect(pane.getByRole('status').filter({ hasText: 'Behavior unchanged' })).toBeVisible();
	await capture(page, `${process.env.SCREENSHOT_LABEL ?? 'run'}-tests-commit-desktop`);
	for (const name of ['Before · aaaaaaa', 'After · bbbbbbb']) {
		const side = pane.getByRole('region', { name });
		await expect(
			side.getByRole('table').filter({ hasText: 'Test observation' }).first()
		).toBeVisible();
		await expect(side).not.toContainText('Actual output');
	}
});

test('mobile test values have readable columns without widening the page', async ({ page }) => {
	await page.setViewportSize(viewports.mobile);
	await open(page, entity);
	const cases = page.locator('.cases').first();
	await expect(cases).toBeVisible();
	await capture(page, `${process.env.SCREENSHOT_LABEL ?? 'run'}-tests-readability-mobile`);
	const capacities = await cases
		.locator('tbody tr')
		.first()
		.locator('td pre')
		.evaluateAll((blocks) =>
			blocks.map((block) => {
				const canvas = document.createElement('canvas');
				const context = canvas.getContext('2d')!;
				context.font = getComputedStyle(block).font;
				return block.getBoundingClientRect().width / context.measureText('M').width;
			})
		);
	for (const characters of capacities) expect(characters).toBeGreaterThanOrEqual(18);
	expect(await fits(page)).toBe(true);
});

test('the full recorded result is available even when it has no input and output pair', async ({
	page
}) => {
	await open(page, entity);
	const artifact = page
		.locator('.ex-artifact')
		.filter({ hasText: 'This result records no input and output.' })
		.first();
	await expect(artifact).toBeVisible();
	await artifact.locator(':scope > details > summary').click();
	await artifact.getByText('Recorded JSON', { exact: true }).click();
	await capture(page, `${process.env.SCREENSHOT_LABEL ?? 'run'}-tests-raw-record`);
	await expect(artifact.locator('details[open] details[open] pre')).toContainText('"input"');
	await expect(artifact.locator('details[open] details[open] pre')).toContainText('"searchText"');
});

test('the mobile output column is reachable inside its table scroller', async ({ page }) => {
	await page.setViewportSize(viewports.mobile);
	await open(page, entity);
	const cases = page.locator('.cases').first();
	await expect(cases).toBeVisible();
	await cases.evaluate((node) => {
		node.scrollLeft = node.scrollWidth - node.clientWidth;
	});
	const output = cases.getByRole('columnheader', { name: 'Observed output' });
	await expect(output).toBeVisible();
	const bounds = await output.boundingBox();
	expect(bounds).not.toBeNull();
	expect(bounds!.x).toBeGreaterThanOrEqual(0);
	expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewports.mobile.width + 1);
	await expect(cases).toContainText('Order 1042 · Service call');
	await capture(page, `${process.env.SCREENSHOT_LABEL ?? 'run'}-tests-output-mobile`);
	expect(await fits(page)).toBe(true);
});
