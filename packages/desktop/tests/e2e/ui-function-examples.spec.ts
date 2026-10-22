import { expect, test, type Page } from '../../../../test/support/browserTest';
import { earlierDesign, imagesAsked, pictured } from './ui-function-examples-fixture';
import { branch, commits, evidenceFixture, ids, sharedProject } from './ui-evidence-fixture';
import { workflowWorkload } from './page-workload';

/**
 * A function in the workspace is shown by what its tests recorded, input beside observed output,
 * and never by a design picture: not on its card, not in a section, not at the former address of
 * its designs. A page keeps its pictures.
 */
const root = `/projects/${sharedProject}/harness/branch/${encodeURIComponent(branch)}`;
const filter = `${root}/functions/${ids.filter}`;
const short = (commit: string) => commit.slice(0, 7);
const tabs = (page: Page) => page.getByRole('navigation', { name: 'Entity sections' });
const current = (page: Page) => tabs(page).locator('[aria-current="page"]');
const runtime = (page: Page) => page.getByRole('region', { name: 'Recorded runtime evidence' });
const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name });
const gap = /records no input and output|Not recorded|not in this history|could not be read/;

async function opened(page: Page, address: string, options: { shared?: boolean } = {}) {
	await earlierDesign(page);
	await evidenceFixture(page, options);
	await workflowWorkload(
		page,
		{
			units: [
				'desktop.page.root',
				'desktop.layout.root',
				'desktop.entry.app-html',
				'desktop.page.projects-project-id-harness-path',
				'desktop.component.workspace-shell'
			],
			name: address.includes('/pages/')
				? 'page-entity-open'
				: address.includes('/functions/')
					? 'function-entity-open'
					: 'function-catalog-open'
		},
		async () => {
			await page.goto(address);
			await expect(page.getByRole('navigation', { name: 'Catalog categories' })).toBeVisible();
			if (address.includes('/functions/'))
				await expect(heading(page, 'filterOrders')).toBeVisible();
			else if (address.includes('/pages/'))
				await expect(heading(page, 'Orders page')).toBeVisible();
			else
				await expect(
					page
						.locator('main.catalog article')
						.filter({ hasText: 'filterOrders(orders, searchText)' })
				).toBeVisible();
		}
	);
}

test('a function is listed and opened without a design picture, and no image is read for it', async ({
	page
}, info) => {
	await opened(page, `${root}/functions`);
	const card = page
		.locator('main.catalog article')
		.filter({ hasText: 'filterOrders(orders, searchText)' });
	await expect(card).toBeVisible();
	await pictured(page, info, 'function-card');
	await expect(card.getByRole('link')).toHaveText(/Review plan/);
	await expect(card).not.toContainText(/design/i);
	await expect(card.locator('img, .thumbnail')).toHaveCount(0);
	await card.getByRole('link').click();
	await expect(heading(page, 'filterOrders')).toBeVisible();
	await expect(tabs(page).getByRole('button')).toHaveText([
		'Overview',
		'Plan',
		'Used In',
		'Uses',
		'Examples',
		'History',
		'Source'
	]);
	await expect(current(page)).toHaveText('Plan');
	await page.goto(`${filter}/designs`);
	await expect(heading(page, 'filterOrders')).toBeVisible();
	await pictured(page, info, 'function-former-designs-address');
	await expect(current(page)).toHaveText('Plan');
	await expect(page.getByText('Returns the orders whose name contains the search')).toBeVisible();
	await expect(page.locator('main img')).toHaveCount(0);
	await expect(page.locator('main')).not.toContainText(/design image|Loading design/i);
	expect((await imagesAsked(page)).filter((id) => id === ids.filter)).toEqual([]);
});

test('a function shows what its tests observed, an input beside the output, one row for each', async ({
	page
}, info) => {
	await opened(page, filter);
	await expect(heading(page, 'filterOrders')).toBeVisible();
	await expect(runtime(page).getByRole('group', { name: /^Current snapshot/ })).toBeVisible();
	await pictured(page, info, 'function-rows');
	const tables = runtime(page).getByRole('table');
	await expect(tables.first().getByRole('columnheader')).toHaveText([
		'Case',
		'Input',
		'Observed output'
	]);
	await expect(tables.filter({ hasText: 'SERVICE' }).first()).toContainText(
		'Order 1042 · Service call'
	);
	// The state without a match records what was asserted and no output: its input is no row.
	await expect(tables.filter({ hasText: 'zzz' })).toHaveCount(0);
	await expect(runtime(page)).toContainText('What a test observed end to end');
	await expect(runtime(page)).not.toContainText('Actual output');
	await expect(runtime(page).locator('img, figure')).toHaveCount(0);
	const kept = runtime(page).locator('details').filter({ hasText: 'Matching order is listed' });
	await expect(kept.first()).toBeAttached();
	await expect(runtime(page).getByText(gap).first()).toBeVisible();
});

test('at a selected commit the parent and the commit each have their own rows, or say why not', async ({
	page
}, info) => {
	await opened(page, `${root}/commit/${commits.middle}/functions/${ids.filter}`);
	await expect(heading(page, 'filterOrders')).toBeVisible();
	const sides = [`Before · ${short(commits.first)}`, `After · ${short(commits.middle)}`];
	for (const name of sides) await expect(runtime(page).getByRole('group', { name })).toBeVisible();
	await pictured(page, info, 'function-commit');
	for (const name of sides) {
		const side = runtime(page).getByRole('group', { name });
		await expect(side.getByRole('table').or(side.getByText(gap)).first()).toBeVisible();
		await expect(side).not.toContainText('Actual output');
	}
});

test('a page keeps its design picture and its Designs section', async ({ page }) => {
	await opened(page, `${root}/pages/${ids.page}`);
	await expect(heading(page, 'Orders page')).toBeVisible();
	await expect(tabs(page).getByRole('button', { name: 'Designs' })).toBeVisible();
	await tabs(page).getByRole('button', { name: 'Designs' }).click();
	await expect(page.locator('main img').first()).toBeVisible();
	expect(await imagesAsked(page)).toContain(ids.page);
});

for (const viewport of [
	{ id: 'tablet', width: 920, height: 1100 },
	{ id: 'mobile', width: 390, height: 844 }
])
	test(`in a hosted project a function shows its rows at ${viewport.id} width, with comments only`, async ({
		page
	}, info) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await opened(page, filter, { shared: true });
		await expect(heading(page, 'filterOrders')).toBeVisible();
		await expect(runtime(page).getByRole('group', { name: /^Current snapshot/ })).toBeVisible();
		await pictured(page, info, `function-rows-${viewport.id}`);
		await expect(runtime(page).getByRole('table').first()).toBeVisible();
		await expect(tabs(page).getByRole('button', { name: 'Designs' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Change', exact: true })).toHaveCount(0);
		const sideways = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
		expect(sideways).toBeLessThanOrEqual(0);
	});

for (const viewport of [
	{ id: 'desktop', width: 1440, height: 900 },
	{ id: 'tablet', width: 920, height: 1100 },
	{ id: 'mobile', width: 390, height: 844 }
])
	test(`committed function uses share the Examples view at ${viewport.id} width`, async ({
		page
	}) => {
		await page.setViewportSize(viewport);
		for (const shared of [false, true]) {
			await evidenceFixture(page, {
				shared,
				documentation: {
					[ids.filter]: {
						path: 'usage.md',
						text: '# Committed usage',
						examples: [
							{
								name: 'Search by name',
								call: 'filterOrders(["Service call"], "SERVICE")',
								input: { search: 'SERVICE' },
								output: ['Service call']
							},
							{
								name: 'No match',
								call: 'filterOrders(["Service call"], "none")',
								input: { search: 'none' },
								output: []
							}
						]
					}
				}
			});
			await page.goto(`${filter}/examples`);
			await expect(current(page)).toHaveText('Examples');
			const examples = page.locator('.examples');
			await expect(examples.getByRole('article')).toHaveCount(2);
			await expect(examples.getByRole('heading')).toHaveText(['Search by name', 'No match']);
			await expect(examples.locator('code')).toHaveText([
				'filterOrders(["Service call"], "SERVICE")\n// => ["Service call"]',
				'filterOrders(["Service call"], "none")\n// => []'
			]);
			await expect(examples.getByRole('table')).toHaveCount(0);
			await expect(page.getByRole('region', { name: 'Evidence coverage' })).toHaveCount(0);
			if (process.env.TAKE_SCREENSHOT === '1')
				await page.screenshot({
					path: `/tmp/harness-shared-examples-${viewport.id}-${shared ? 'hosted' : 'local'}.png`,
					fullPage: true
				});
			await expect(page.getByText('Recorded tests and verification', { exact: true })).toHaveCount(
				0
			);
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
			).toBeLessThanOrEqual(0);
		}
	});
