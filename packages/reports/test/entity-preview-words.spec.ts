import { expect, test, type Locator } from '../../../test/support/browserTest';
import { capture, fits, open, viewports } from './entityPreviewPage';
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
	await open(tab, { category: 'components', commit: commits.middle });
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
	// The overview names the items and leaves what each is to the details.
	await open(tab, { category: 'pages', entity: ids.page, commit: commits.middle }, 'declared');
	await expect(tab.getByText('The branch, as one encoded path segment.')).toHaveCount(0);
});
