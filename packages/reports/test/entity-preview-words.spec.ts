import { expect, test, type Locator, type Page } from '../../../test/support/browserTest';
import { capture, fits, open, viewports, where } from './entityPreviewPage';
import { commits, ids } from './entityUnits';

/** How many words of an element are drawn across more than one line. */
const broken = (cell: Locator): Promise<number> =>
	cell.evaluate((element) => {
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
		let count = 0;
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			for (const found of (node.textContent ?? '').matchAll(/\S+/g)) {
				const range = document.createRange();
				range.setStart(node, found.index);
				range.setEnd(node, found.index + found[0].length);
				if (range.getClientRects().length > 1) count += 1;
			}
		}
		return count;
	});
// Names as long as real ones are: each word is wider than the heading of a narrow column.
const long = 'Internationalization analytics + 1 more';

test('a long word in a narrow column of a collection stays whole, and the table scrolls', async ({
	page: tab
}) => {
	await tab.setViewportSize(viewports.mobile);
	await open(tab, { category: 'services', commit: commits.middle });
	const cells = tab.locator('.ex-table tbody tr').first().locator('td');
	for (const position of [0, 1]) {
		await cells.nth(position).evaluate((cell, text) => (cell.textContent = text), long);
	}
	expect(await broken(cells.nth(0))).toBe(0);
	expect(await broken(cells.nth(1))).toBe(0);
	// The table is wider than the window and scrolls inside its own frame; the page does not.
	expect(await fits(tab)).toBe(true);
});

test('a long word in a row of a history stays whole too', async ({ page: tab }) => {
	await tab.setViewportSize(viewports.mobile);
	const filter = {
		category: 'functions' as const,
		entity: ids.filter,
		section: 'history' as const
	};
	await open(tab, { ...filter, commit: commits.middle });
	const row = tab.locator('.ex-history tbody tr').first();
	const said = row.locator('td.ex-said').first();
	await said.evaluate((cell, text) => (cell.textContent = text), long);
	expect(await broken(said)).toBe(0);
	expect(await broken(row.locator('td').first())).toBe(0);
	expect(await fits(tab)).toBe(true);
});

test('the details of a declared contract say what each item is, and fit a phone', async ({
	page: tab
}) => {
	const page = { category: 'pages' as const, entity: ids.page, section: 'details' as const };
	await open(tab, { ...page, commit: commits.middle }, 'declared');
	const contract = tab.getByRole('region', { name: 'Contract' });
	await expect(contract.getByText('The branch, as one encoded path segment.')).toBeVisible();
	await expect(contract.getByText('A missing page is said, not replaced.')).toBeVisible();
	await capture(tab, 'details-declared-desktop');
	await tab.setViewportSize(viewports.mobile);
	expect(await fits(tab)).toBe(true);
	await capture(tab, 'details-declared-mobile');
	// The dedicated Contract tab explains it without requiring technical details.
	await open(tab, { category: 'pages', entity: ids.page, commit: commits.middle }, 'declared');
	await expect(tab.getByRole('region', { name: 'Contract', exact: true })).toHaveCount(0);
	await tab.getByRole('tab', { name: 'Contract', exact: true }).click();
	await expect(tab.getByText('The branch, as one encoded path segment.')).toBeVisible();
});

/** The same field interaction in every revision and viewport, over declared and legacy examples. */
async function reviewExamples(tab: Page, contract: Locator, checkpoint: string): Promise<void> {
	const info = contract.getByRole('button', { name: 'View example for Branch', exact: true });
	await expect(info).toHaveAttribute('aria-haspopup', 'dialog');
	await info.click();
	const dialog = tab.getByRole('dialog');
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText('feature/orders');
	await expect(dialog).toContainText('Declared');
	await expect(dialog).toContainText('string');
	await capture(tab, `contract-example-${checkpoint}`);
	await tab.keyboard.press('Escape');
	await expect(dialog).toHaveCount(0);
	await expect(info).toBeFocused();
	for (const [name, sample] of [
		['Enabled', 'false'],
		['Limit', '0'],
		['Empty', 'null'],
		['Query', '""'],
		['Settings', 'Safe <tag>'],
		['Commit', 'Example not recorded'],
		['Label', 'Illustrative']
	]) {
		await contract.getByRole('button', { name: `View example for ${name}`, exact: true }).click();
		await expect(dialog).toContainText(sample);
		await expect(dialog.locator('tag')).toHaveCount(0);
		if (name === 'Settings') await expect(dialog).toContainText('Other');
		expect(await fits(tab)).toBe(true);
		await dialog.getByRole('button', { name: 'Close', exact: true }).click();
	}
	const output = contract.getByRole('table', { name: 'Outputs', exact: true });
	await output.getByRole('button').click();
	await expect(dialog).toContainText('<main>Orders</main>');
	await expect(dialog.locator('main')).toHaveCount(0);
	await dialog.getByRole('button', { name: 'Close', exact: true }).click();
}

for (const [width, size] of Object.entries(viewports)) {
	test(`contract has its own typed example view at ${width} width`, async ({ page: tab }) => {
		await tab.setViewportSize(size);
		for (const commit of [null, commits.middle]) {
			await open(tab, { category: 'pages', entity: ids.page, commit }, 'declared');
			await capture(tab, `contract-overview-${commit ? 'commit' : 'tip'}-${width}`);
			await expect(
				tab.getByRole('tab', { name: 'Contract', exact: true }),
				'contract has its own tab'
			).toHaveCount(1);
			await expect(tab.getByRole('region', { name: 'Contract', exact: true })).toHaveCount(0);
			await tab.getByRole('tab', { name: 'Contract', exact: true }).click();
			const contract = tab.getByRole('region', { name: 'Contract', exact: true });
			await expect(contract).toBeVisible();
			await tab.evaluate(async () => {
				await document.fonts.ready;
			});
			await capture(tab, `contract-fields-${commit ? 'commit' : 'tip'}-${width}`);
			const inputs = contract.getByRole('table', { name: 'Inputs', exact: true });
			await expect(inputs, 'contract inputs are a table').toBeVisible();
			await expect(inputs.getByRole('row').filter({ hasText: 'Branch' })).toContainText('string');
			await expect(contract.getByRole('table', { name: 'Outputs', exact: true })).toBeVisible();
			await expect(contract).not.toContainText('feature/orders');
			await expect(contract).not.toContainText('<main>Orders</main>');
			await expect(contract).toContainText('The branch, as one encoded path segment.');
			await expect(contract.getByRole('img')).toHaveCount(0);
			await reviewExamples(tab, contract, `${commit ? 'commit' : 'tip'}-${width}`);
			expect(await where(tab)).toMatchObject({
				commit,
				category: 'pages',
				entity: ids.page,
				tab: 'contract'
			});
			expect(await fits(tab)).toBe(true);
		}
	});
}
