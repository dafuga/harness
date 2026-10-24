import { expect, test, type Locator, type Page } from '../../../test/support/browserTest';
import { capture, fits, open, viewports, where } from './entityPreviewPage';
import { reviewCallableContract } from './entityCallableContract';
import { commits, ids } from './entityUnits';

/** Count words split across lines or drawn beyond their own column. */
const broken = (cell: Locator): Promise<number> =>
	cell.evaluate((element) => {
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
		let count = 0;
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			for (const found of (node.textContent ?? '').matchAll(/\S+/g)) {
				const range = document.createRange();
				range.setStart(node, found.index);
				range.setEnd(node, found.index + found[0].length);
				if (
					range.getClientRects().length > 1 ||
					range.getBoundingClientRect().right > element.getBoundingClientRect().right + 1
				)
					count += 1;
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
	await open(tab, { category: 'configs', commit: commits.middle });
	const cells = tab.locator('.ex-table tbody tr').first().locator('th, td');
	for (const position of [0, 1]) {
		await cells.nth(position).evaluate((cell, text) => (cell.textContent = text), long);
	}
	await capture(tab, 'collection-long-words-mobile');
	expect(await broken(cells.nth(0))).toBe(0);
	expect(await broken(cells.nth(1))).toBe(0);
	// The table is wider than the window and scrolls inside its own frame; the page does not.
	expect(
		await tab.locator('.ex-scroll').evaluate((frame) => frame.scrollWidth > frame.clientWidth)
	).toBe(true);
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
	const page = { category: 'configs' as const, entity: ids.settings, section: 'details' as const };
	await open(tab, { ...page, commit: commits.middle }, 'declared');
	const contract = tab.getByRole('region', { name: 'Contract' });
	await expect(contract).not.toContainText('The branch, as one encoded path segment.');
	await contract.getByRole('button', { name: 'View example for Branch', exact: true }).click();
	await expect(tab.getByRole('dialog')).toContainText('The branch, as one encoded path segment.');
	await tab.getByRole('button', { name: 'Close viewer', exact: true }).click();
	await contract
		.getByRole('button', { name: 'View example for Not at revision', exact: true })
		.click();
	await expect(tab.getByRole('dialog')).toContainText('A missing page is said, not replaced.');
	await tab.getByRole('button', { name: 'Close viewer', exact: true }).click();
	await capture(tab, 'details-declared-desktop');
	await tab.setViewportSize(viewports.mobile);
	expect(await fits(tab)).toBe(true);
	await capture(tab, 'details-declared-mobile');
	// The dedicated Contract tab explains it without requiring technical details.
	await open(
		tab,
		{ category: 'configs', entity: ids.settings, commit: commits.middle },
		'declared'
	);
	await expect(tab.getByRole('region', { name: 'Contract', exact: true })).toHaveCount(0);
	await tab.getByRole('tab', { name: 'Contract', exact: true }).click();
	await contract.getByRole('button', { name: 'View example for Branch', exact: true }).click();
	await expect(tab.getByRole('dialog')).toContainText('The branch, as one encoded path segment.');
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
	await expect(dialog).toContainText('The branch, as one encoded path segment.');
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
		await dialog.getByRole('button', { name: 'Close viewer', exact: true }).click();
	}
	const output = contract.getByRole('table', { name: 'Provides', exact: true });
	await output.getByRole('button').click();
	await expect(dialog).toContainText('<main>Orders</main>');
	await expect(dialog.locator('main')).toHaveCount(0);
	await dialog.getByRole('button', { name: 'Close viewer', exact: true }).click();
}

/** Closed rows preview examples, clip long values and end with an accessible details control. */
async function compactExamples(table: Locator): Promise<void> {
	await expect(
		table.getByRole('columnheader', { name: 'Example', exact: true }),
		'contract has an Example column'
	).toBeVisible();
	await expect(table.getByRole('columnheader', { name: 'Description', exact: true })).toHaveCount(
		0
	);
	const branch = table.getByRole('row').filter({ hasText: 'Branch' });
	await expect(branch.getByRole('cell').nth(1)).toContainText('feature/orders');
	await expect(branch.getByRole('cell').last().getByRole('button')).toHaveAttribute(
		'aria-haspopup',
		'dialog'
	);
	const available = await branch
		.getByRole('cell')
		.nth(1)
		.locator('code')
		.evaluate((code) => {
			const end = code.closest('tr')!.lastElementChild!.getBoundingClientRect().left;
			return Math.min(innerWidth, end) - code.getBoundingClientRect().left;
		});
	expect(available, 'example preview is visible beside the action').toBeGreaterThan(24);
	const contained = await branch
		.getByRole('cell')
		.last()
		.evaluate((cell) => {
			const button = cell.querySelector('button')!.getBoundingClientRect();
			const box = cell.getBoundingClientRect();
			return button.left >= box.left && button.right <= box.right + 1;
		});
	expect(contained, 'info button fits within its trailing cell').toBe(true);
	const settings = table.getByRole('row').filter({ hasText: 'Settings' });
	const clipped = await settings
		.getByRole('cell')
		.nth(1)
		.evaluate((cell) =>
			[cell, ...cell.querySelectorAll('*')].some((element) => {
				const style = getComputedStyle(element);
				return style.textOverflow === 'ellipsis' && element.scrollWidth > element.clientWidth;
			})
		);
	expect(clipped, 'long example is visibly clipped with an ellipsis').toBe(true);
}

for (const [width, size] of Object.entries(viewports)) {
	test(`contract has its own typed example view at ${width} width`, async ({ page: tab }) => {
		await tab.setViewportSize(size);
		for (const commit of [null, commits.middle]) {
			await open(tab, { category: 'configs', entity: ids.settings, commit }, 'declared');
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
			await expect(contract.getByRole('table', { name: 'Provides', exact: true })).toBeVisible();
			await compactExamples(inputs);
			await expect(contract).toContainText('<main>Orders</main>');
			await expect(contract).not.toContainText('The branch, as one encoded path segment.');
			await expect(contract.getByRole('img')).toHaveCount(0);
			await reviewExamples(tab, contract, `${commit ? 'commit' : 'tip'}-${width}`);
			expect(await where(tab)).toMatchObject({
				commit,
				category: 'configs',
				entity: ids.settings,
				tab: 'contract'
			});
			expect(await fits(tab)).toBe(true);
			await reviewCallableContract(tab, commit, width);
		}
	});
}
