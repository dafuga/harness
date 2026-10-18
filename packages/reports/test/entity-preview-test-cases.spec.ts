import { expect, test } from '../../../test/support/browserTest';
import { capture, fits, open, viewports } from './entityPreviewPage';
import { commits, ids } from './entityUnits';

const entity = { category: 'services' as const, entity: ids.store, tab: 'tests' as const };

test('the default test view explains input and output without requiring JSON', async ({ page }) => {
	await open(page, entity);
	const item = page.locator('.cases > table > tbody > tr').first();
	await expect(item.locator('dt')).toHaveText(['Search text']);
	await expect(item.locator('dd')).toHaveText('TextSERVICE');
	await expect(item.locator('td[data-label="Observed output"] .value-list')).toContainText(
		'Order 1042 · Service call'
	);
	await expect(item.locator('pre')).toHaveCount(0);
});

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
		.locator(':scope > td > .case-value > .recorded-value')
		.evaluateAll((blocks) =>
			blocks.map((block) => {
				const canvas = document.createElement('canvas');
				const context = canvas.getContext('2d')!;
				context.font = getComputedStyle(block).font;
				return block.getBoundingClientRect().width / context.measureText('M').width;
			})
		);
	expect(capacities).toHaveLength(2);
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

test('the mobile output panel is visible beneath its input', async ({ page }) => {
	await page.setViewportSize(viewports.mobile);
	await open(page, entity);
	const cases = page.locator('.cases').first();
	await expect(cases).toBeVisible();
	const row = cases.locator('tbody tr').first();
	const output = row.locator('td[data-label="Observed output"]');
	await output.scrollIntoViewIfNeeded();
	await expect(output).toBeVisible();
	await expect(output.locator('.recorded-value')).toContainText('Order 1042 · Service call');
	expect(await output.evaluate((node) => getComputedStyle(node, '::before').content)).toBe(
		'"Observed output"'
	);
	const bounds = await output.boundingBox();
	const input = await row.locator('td[data-label="Input"]').boundingBox();
	expect(bounds).not.toBeNull();
	expect(bounds!.y).toBeGreaterThan(input!.y);
	expect(bounds!.y).toBeGreaterThanOrEqual(0);
	expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewports.mobile.height + 1);
	expect(bounds!.x).toBeGreaterThanOrEqual(0);
	expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewports.mobile.width + 1);
	await capture(page, `${process.env.SCREENSHOT_LABEL ?? 'run'}-tests-output-mobile`);
	expect(await fits(page)).toBe(true);
});

for (const [viewport, size] of Object.entries(viewports)) {
	test(`case names lead roomy input and output panels at ${viewport} width`, async ({ page }) => {
		await page.setViewportSize(size);
		await open(page, entity);
		const cases = page.locator('.cases').first();
		const row = cases.locator('tbody tr').first();
		await row.scrollIntoViewIfNeeded();
		await capture(page, `${process.env.SCREENSHOT_LABEL ?? 'run'}-case-flow-${viewport}`);
		const heading = await row.getByRole('rowheader').boundingBox();
		const values = await row.locator('td').all();
		const input = await values[0].boundingBox();
		const output = await values[1].boundingBox();
		const frame = await row.boundingBox();
		expect(heading!.y + heading!.height).toBeLessThanOrEqual(input!.y + 1);
		const minimum = viewport === 'mobile' ? 0.85 : 0.4;
		expect(input!.width / frame!.width).toBeGreaterThan(minimum);
		expect(output!.width / frame!.width).toBeGreaterThan(minimum);
		if (viewport === 'mobile') expect(output!.y).toBeGreaterThan(input!.y);
		expect(await fits(page)).toBe(true);
		await cases.getByText('Full recorded values', { exact: true }).click();
		await expect(cases.locator('details[open] pre')).toContainText('"searchText"');
		await expect(cases.locator('details[open] pre')).toContainText('Order 1042 · Service call');
	});
}

// Extend the existing revision/viewport case matrix to authored function usage, without a run.
for (const [viewport, size] of Object.entries(viewports)) {
	test(`function Examples show committed uses at ${viewport} width`, async ({ page }) => {
		await page.setViewportSize(size);
		for (const commit of [null, commits.middle]) {
			await open(
				page,
				{ category: 'functions', entity: ids.filter, commit, tab: 'tests' },
				'documented'
			);
			await capture(page, `examples-entry-${commit ? 'commit' : 'tip'}-${viewport}`);
			const examples = page.getByRole('tab', { name: 'Examples', exact: true });
			await expect(examples, 'functions expose Examples instead of Tests').toHaveCount(1);
			await expect(page.getByRole('tab', { name: 'Tests', exact: true })).toHaveCount(0);
			await examples.click();
			const pane = page.getByRole('tabpanel', { name: 'Filter orders examples', exact: true });
			await expect(pane).toBeVisible();
			const rows = pane.locator('.cases > table > tbody > tr');
			await expect(rows).toHaveCount(3);
			await expect(rows.first()).toContainText(
				commit ? 'Search the earlier catalog' : 'Find a matching order'
			);
			await expect(rows.first()).toContainText('SERVICE');
			await expect(rows.first()).toContainText('Service call');
			await expect(rows.last()).toContainText('false');
			await expect(rows.last()).toContainText('0');
			await expect(rows.last()).toContainText('null');
			await expect(pane.getByRole('columnheader')).toHaveText([
				'Example',
				'Input',
				'Expected output'
			]);
			await expect(pane.locator('tag')).toHaveCount(0);
			await expect(
				pane.getByText('No usable verification record judges this revision.')
			).not.toBeVisible();
			await pane.getByText('Committed document', { exact: true }).click();
			await expect(pane.locator('pre').last()).toContainText('Committed usage documentation');
			await pane.getByText('Committed document', { exact: true }).click();
			await capture(page, `examples-cases-${commit ? 'commit' : 'tip'}-${viewport}`);
			expect(await fits(page)).toBe(true);
		}
		await open(page, { category: 'functions', entity: ids.filter, tab: 'tests' });
		const pane = page.getByRole('tabpanel', { name: 'Filter orders examples', exact: true });
		await expect(pane).toContainText('No usage examples are documented at this commit.');
		await expect(pane.locator('.cases')).toHaveCount(0);
		await pane.getByText('Recorded tests and verification', { exact: true }).click();
		await expect(pane.getByRole('heading', { name: /Verification at/ })).toBeVisible();
	});
}
