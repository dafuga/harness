import { expect, test, type Page } from '../../../../test/support/browserTest';
import { branch, commits, evidenceFixture, ids, sharedProject } from './ui-evidence-fixture';
import { remember } from './ui-test-cases-capture';

const root = `/projects/${sharedProject}/harness/branch/${encodeURIComponent(branch)}`;
const extra = [ids.list, ids.page, ids.settings];
const graph = { nodes: ['Price formatter', 'Product page'], edges: [[1, 0]] };
const example = {
	input: {
		base: graph,
		head: graph,
		changed: ['Price formatter'],
		uncertain: [],
		sinks: ['Product page']
	},
	output: {
		affected: [
			{ id: 'Price formatter', distance: 0, via: 'both', presence: 'both', seed: 'changed' },
			{ id: 'Product page', distance: 1, via: 'both', presence: 'both', seed: null }
		],
		uncovered: [],
		unknown: []
	}
};
const cases = [
	{ category: 'components', id: ids.list, state: 'component-current' },
	{ category: 'services', id: ids.store, state: 'service-current' },
	{ category: 'pages', id: ids.page, state: 'page-current' },
	{ category: 'configs', id: ids.settings, state: 'config-current' }
];

for (const shown of cases) {
	test(`${shown.state} uses the common input and observed output table`, async ({ page }, info) => {
		await evidenceFixture(page, { shared: true, observedUnits: extra });
		const address = `${root}/${shown.category}/${shown.id}/evidence`;
		await openCoverage(page, address);
		const region = page.getByRole('region', { name: 'Evidence coverage' });
		await expect(
			region.getByRole('heading', { name: /Search across synthetic orders/ }).first()
		).toBeVisible();
		const observed = await remember(page, info, shown.state, { address, mode: 'current' });
		const table = region.getByRole('table').filter({ hasText: 'Observed output' }).first();
		await expect(table.getByRole('columnheader')).toHaveText(['Case', 'Input', 'Observed output']);
		await expect(table).toContainText('SERVICE');
		await expect(table).toContainText('Order 1042 · Service call');
		await expect(region).not.toContainText('Actual output');
		expect(observed.tables.flat(2).join(' ')).toContain('SERVICE');
		await expect(
			page.getByRole('group', { name: 'Request mode' }).getByRole('button', { name: /Plan|Change/ })
		).toHaveCount(0);
	});
}

for (const viewport of [
	{ id: 'desktop', width: 1440, height: 900 },
	{ id: 'tablet', width: 920, height: 1100 },
	{ id: 'mobile', width: 390, height: 844 }
]) {
	test(`nested values stay readable under the host styles at ${viewport.id} width`, async ({
		page
	}, info) => {
		await page.setViewportSize(viewport);
		await evidenceFixture(page, { shared: true, observedUnits: extra, example });
		const address = `${root}/components/${ids.list}/evidence`;
		await openCoverage(page, address);
		const output = page.getByRole('group', { name: 'output of match' });
		await expect(output.getByText('Price formatter', { exact: true }).first()).toBeVisible();
		await remember(page, info, 'nested-values', { address, mode: 'current' });
		for (const fields of await output.locator('.recorded-value > dl').all()) {
			const layout = await fields.locator(':scope > div').evaluateAll((rows) =>
				rows.map((row) => {
					const rect = row.getBoundingClientRect();
					return {
						y: rect.y,
						bottom: rect.bottom,
						width: rect.width,
						parent: row.parentElement!.getBoundingClientRect().width
					};
				})
			);
			expect(layout.length).toBeGreaterThan(1);
			expect(layout[0].width).toBeGreaterThan(layout[0].parent * 0.95);
			for (let i = 1; i < layout.length; i++)
				expect(layout[i].y).toBeGreaterThanOrEqual(layout[i - 1].bottom);
		}
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
			true
		);
	});

	test(`contract fields stay readable under the host styles at ${viewport.id} width`, async ({
		page
	}, info) => {
		await page.setViewportSize(viewport);
		await evidenceFixture(page, { shared: true });
		const address = `${root}/functions/${ids.filter}`;
		await openCoverage(page, address);
		const contract = page.getByRole('heading', { name: 'Contract', exact: true }).locator('..');
		await expect(contract.getByRole('heading', { name: 'Accepts', exact: true })).toBeVisible();
		await remember(page, info, 'readable-contracts', { address, mode: 'current' });
		const rows = await contract
			.locator('dl')
			.first()
			.locator(':scope > div')
			.evaluateAll((items) =>
				items.map((item) => {
					const rect = item.getBoundingClientRect();
					return {
						y: rect.y,
						bottom: rect.bottom,
						width: rect.width,
						parent: item.parentElement!.getBoundingClientRect().width
					};
				})
			);
		expect(rows).toHaveLength(2);
		expect(rows[0].width).toBeGreaterThan(rows[0].parent * 0.95);
		expect(rows[1].y).toBeGreaterThanOrEqual(rows[0].bottom);
	});
}

test('component-commit separates parent and selected-commit input and output', async ({
	page
}, info) => {
	await evidenceFixture(page, { shared: true, observedUnits: extra });
	const address = `${root}/commit/${commits.tip}/components/${ids.list}/evidence`;
	await openCoverage(page, address);
	const region = page.getByRole('region', { name: 'Evidence coverage' });
	await expect(
		region.getByRole('heading', { name: /Search across synthetic orders/ }).first()
	).toBeVisible();
	await remember(page, info, 'component-commit', { address, mode: 'commit' });
	for (const name of [
		`Before · ${commits.middle.slice(0, 7)}`,
		`After · ${commits.tip.slice(0, 7)}`
	]) {
		const side = region.getByRole('group', { name, exact: true });
		await expect(side.getByRole('table').first()).toContainText('SERVICE');
	}
	const before = region.getByRole('group', { name: /^Before ·/ });
	const after = region.getByRole('group', { name: /^After ·/ });
	await expect(before.getByRole('table').first()).not.toContainText('Order 1077 · Service plan');
	await expect(after.getByRole('table').first()).toContainText('Order 1077 · Service plan');
});

for (const viewport of [
	{ id: 'tablet', width: 920, height: 1100 },
	{ id: 'mobile', width: 390, height: 844 }
]) {
	test(`component-current shows recorded input and output at ${viewport.id} width`, async ({
		page
	}, info) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await evidenceFixture(page, { shared: true, observedUnits: extra });
		const address = `${root}/components/${ids.list}/evidence`;
		await openCoverage(page, address);
		const region = page.getByRole('region', { name: 'Evidence coverage' });
		await expect(
			region.getByRole('heading', { name: /Search across synthetic orders/ }).first()
		).toBeVisible();
		await remember(page, info, 'component-current', { address, mode: 'current' });
		await expect(
			region.getByRole('table').filter({ hasText: 'Observed output' }).first()
		).toContainText('SERVICE');
		await expect(
			region.getByRole('table').filter({ hasText: 'Observed output' }).first()
		).toContainText('Order 1042 · Service call');
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
			true
		);
	});
}

/** Visual entities keep diagnostics inside the existing States disclosure. */
async function openCoverage(page: Page, address: string): Promise<void> {
	await page.goto(address);
	const tabs = page.getByRole('navigation', { name: 'Entity sections' });
	await tabs.waitFor();
	if (await tabs.getByRole('button', { name: 'States', exact: true }).count())
		await page.getByText('Verification details', { exact: true }).click();
}
