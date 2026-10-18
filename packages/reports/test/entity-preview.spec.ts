import { expect, test } from '../../../test/support/browserTest';
import { capture, fits, open, viewports, where } from './entityPreviewPage';
import { commits, ids } from './entityUnits';

const page = { category: 'pages' as const, entity: ids.page };
const filter = { category: 'functions' as const, entity: ids.filter };
const shots = '.ex-evidence .ex-shot img';
test('collections: search, changed only and order change what is listed', async ({ page: tab }) => {
	await open(tab);
	await expect(tab.getByRole('heading', { level: 1, name: 'Pages' })).toBeVisible();
	const thumb = tab.getByRole('img', { name: 'Screenshot of Orders page' });
	await expect(thumb).toHaveJSProperty('complete', true);
	expect(await thumb.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1440);
	await capture(tab, 'pages-desktop');
	await open(tab, { category: 'components', commit: commits.middle });
	const rows = tab.getByRole('article');
	await expect(rows).toHaveCount(3);
	await capture(tab, 'components-desktop');
	// The footer explains the two marks by showing them; what each means is told on request.
	const key = tab.locator('.ex-legend');
	expect(await key.innerText()).not.toMatch(/proven|passed|failed/i);
	await key.getByRole('button', { name: 'Not proven' }).hover();
	await expect(tab.getByRole('tooltip')).toContainText('is missing, is stale or is unknown');
	await tab.mouse.move(1, 1);
	await tab.getByRole('searchbox', { name: 'Search components' }).fill('card');
	await expect(rows).toHaveCount(1);
	await expect(rows.first()).toContainText('Order card');
	await tab.getByRole('searchbox', { name: 'Search components' }).fill('zzz');
	await expect(tab.getByText('No components match this search.')).toBeVisible();
	await tab.getByRole('button', { name: 'Show all components' }).click();
	await expect(rows).toHaveCount(3);
	await tab.getByRole('switch').check();
	await expect(rows).toHaveCount(1);
	await expect(rows.first()).toContainText('Order list');
	await tab.getByRole('switch').uncheck();
	await tab.getByRole('combobox', { name: 'Order' }).selectOption('name-desc');
	await expect(rows.first()).toContainText('Search box');
});

test('a row or a card of a collection opens its entity in the same branch and commit', async ({
	page: tab
}) => {
	const branch = 'feature/orders';
	await open(tab, { category: 'functions', commit: commits.middle });
	await tab.getByRole('link', { name: 'Filter orders', exact: true }).click();
	expect(await where(tab)).toEqual({ branch, commit: commits.middle, ...filter });
	await expect(tab.getByRole('heading', { level: 1, name: 'Filter orders' })).toBeVisible();
	await open(tab, { category: 'components' });
	await tab.getByRole('link', { name: 'Open Order card' }).click();
	expect(await where(tab)).toEqual({
		branch,
		commit: null,
		category: 'components',
		entity: ids.card
	});
	await expect(tab.getByRole('heading', { level: 1, name: 'Order card' })).toBeVisible();
	await open(tab);
	await tab.getByRole('link', { name: 'Open Orders page' }).click();
	expect(await where(tab)).toEqual({ branch, commit: null, ...page });
	// The way back to the collection keeps the branch tip too.
	await tab
		.getByRole('navigation', { name: 'Breadcrumb' })
		.getByRole('link', { name: 'Pages' })
		.click();
	expect(await where(tab)).toEqual({ branch, commit: null, category: 'pages' });
});

test('a page shows one screenshot at the tip and a matching pair at a commit', async ({
	page: tab
}) => {
	await open(tab, page);
	await expect(tab.getByRole('heading', { name: 'Current screenshot' })).toBeVisible();
	await expect(tab.locator(shots)).toHaveCount(1);
	await expect(tab.locator(shots)).toHaveAttribute('src', '/media/ccccccc-default-desktop.png');
	await capture(tab, 'page-current-desktop');
	await tab.getByRole('button', { name: 'Mobile' }).click();
	await expect(tab.locator(shots)).toHaveAttribute('src', '/media/ccccccc-default-mobile.png');
	await tab.getByRole('combobox', { name: 'State' }).selectOption('empty');
	await expect(tab.locator(shots)).toHaveAttribute('src', '/media/ccccccc-empty-mobile.png');
	await open(tab, { ...page, commit: commits.middle });
	await expect(tab.getByRole('heading', { name: 'Commit comparison' })).toBeVisible();
	const sources = () =>
		tab.locator(shots).evaluateAll((all) => all.map((image) => image.getAttribute('src')));
	expect(await sources()).toEqual([
		'/media/aaaaaaa-default-desktop.png',
		'/media/bbbbbbb-default-desktop.png'
	]);
	await capture(tab, 'page-commit-desktop');
	await tab.getByRole('button', { name: 'Mobile' }).click();
	expect(await sources()).toEqual([
		'/media/aaaaaaa-default-mobile.png',
		'/media/bbbbbbb-default-mobile.png'
	]);
	await tab.getByRole('button', { name: 'Open full size' }).last().click();
	await expect(tab.getByRole('dialog')).toBeVisible();
});

test('a function shows its recorded run: steps, input, output and assertions', async ({
	page: tab
}) => {
	await open(tab, { ...filter, commit: commits.middle });
	await expect(tab.getByRole('heading', { name: 'End-to-end test comparison' })).toBeVisible();
	// The results are read as the entity opens; what they did is said once they were.
	await expect(tab.getByRole('status').filter({ hasText: 'Behavior unchanged' })).toBeVisible();
	// Both sides show what the run did without anything to press.
	for (const side of ['Before · aaaaaaa', 'After · bbbbbbb']) {
		const pane = tab.getByRole('region', { name: side });
		await expect(pane.getByRole('table').first()).toBeVisible();
		await pane
			.locator('details')
			.filter({ hasText: 'Matching order is listed' })
			.first()
			.locator(':scope > summary')
			.click();
		await expect(pane.getByText('Search SERVICE').first()).toBeVisible();
		await expect(pane.getByText('Order 1042 · Service call')).toBeVisible();
		await expect(pane.getByText('Matching order is listed').first()).toBeVisible();
		await expect(pane.getByRole('button', { name: /show|load|open the/i })).toHaveCount(0);
		// Nothing of a small result is cut off: each block is as tall as what it holds.
		const cut = await pane
			.locator('pre')
			.evaluateAll((all) => all.filter((block) => block.scrollHeight > block.clientHeight + 1));
		expect(cut).toHaveLength(0);
	}
	await capture(tab, 'function-commit-desktop');
	await open(tab, filter);
	await expect(tab.getByRole('heading', { name: 'Current end-to-end behavior' })).toBeVisible();
	await expect(tab.getByText('Before ·')).toHaveCount(0);
	await capture(tab, 'function-current-desktop');
});

test('links walk page to component to function, and keep the branch and the commit', async ({
	page: tab
}) => {
	await open(tab, { ...page, commit: commits.middle });
	await tab.getByRole('tab', { name: 'Uses', exact: true }).click();
	expect(await where(tab)).toMatchObject({
		entity: ids.page,
		tab: 'uses',
		commit: commits.middle
	});
	await capture(tab, 'page-uses-desktop');
	await tab.getByRole('link', { name: 'Order list' }).click();
	expect(await where(tab)).toEqual({
		branch: 'feature/orders',
		commit: commits.middle,
		category: 'components',
		entity: ids.list
	});
	await tab.getByRole('tab', { name: 'Uses', exact: true }).click();
	await tab.getByRole('link', { name: 'Filter orders' }).click();
	expect(await where(tab)).toMatchObject({
		category: 'functions',
		entity: ids.filter,
		commit: commits.middle
	});
	await expect(tab.getByRole('heading', { level: 1, name: 'Filter orders' })).toBeVisible();
});

test('one entity page keeps source optional without a duplicate Details page', async ({
	page: tab
}) => {
	for (const [name, size] of Object.entries(viewports)) {
		await tab.setViewportSize(size);
		await open(tab, filter);
		await tab.evaluate(async () => {
			await document.fonts.ready;
		});
		await capture(tab, `unified-function-${name}`);
		await expect(
			tab.getByRole('link', { name: 'Details', exact: true }),
			'no second Details page'
		).toHaveCount(0);
		await expect(tab.getByText('Source ownership')).toHaveCount(0);
		await tab.getByRole('tab', { name: 'Source', exact: true }).click();
		expect(await where(tab)).toEqual({
			branch: 'feature/orders',
			commit: null,
			...filter,
			tab: 'source'
		});
		await expect(tab.getByText('src/functions/filterOrders.ts', { exact: true })).toBeVisible();
		await tab.getByRole('tab', { name: 'Overview', exact: true }).click();
		expect(await where(tab)).toEqual({ branch: 'feature/orders', commit: null, ...filter });
	}
});

test('history lists changes, keeps profiles apart and opens a revision', async ({ page: tab }) => {
	await open(tab, { ...filter, section: 'history', commit: commits.middle });
	await expect(tab.locator('.ex-history tbody tr')).toHaveCount(2);
	await expect(tab.getByText('0.15 → 0.12 ms').first()).toBeVisible();
	await capture(tab, 'function-history-desktop');
	await tab.getByRole('combobox', { name: 'Performance profile' }).selectOption('ci-linux');
	await expect(tab.getByRole('columnheader', { name: 'Timing (ci-linux)' })).toBeVisible();
	await expect(tab.locator('.ex-history tbody tr').first()).toContainText('0.31 ms');
	await tab.getByRole('link', { name: 'View revision aaaaaaa' }).click();
	expect(await where(tab)).toEqual({ branch: 'feature/orders', commit: commits.first, ...filter });
	await expect(tab.getByText('First version')).toBeVisible();
});

for (const [name, size] of Object.entries(viewports)) {
	test(`every screen fits a ${name} window without scrolling sideways`, async ({ page: tab }) => {
		await tab.setViewportSize(size);
		const routes = [
			{},
			{ category: 'services' as const, commit: commits.middle },
			{ ...page, commit: commits.middle },
			{ ...filter, commit: commits.middle },
			{ ...filter, section: 'history' as const, commit: commits.middle },
			{ ...page, tab: 'source' as const },
			{ category: 'configs' as const, entity: ids.settings }
		];
		for (const [position, route] of routes.entries()) {
			await open(tab, route);
			expect(await fits(tab), `route ${position} at ${name}`).toBe(true);
			await capture(tab, `fit-${position}-${name}`);
		}
	});
}
