import { expect, test } from '@playwright/test';
import { branch, commits, evidenceFixture, ids, sharedProject } from './ui-evidence-fixture';
import { remember } from './ui-test-cases-capture';

const root = `/projects/${sharedProject}/harness/branch/${encodeURIComponent(branch)}`;
const extra = [ids.list, ids.page, ids.settings];
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
		await page.goto(address);
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

test('component-commit separates parent and selected-commit input and output', async ({
	page
}, info) => {
	await evidenceFixture(page, { shared: true, observedUnits: extra });
	const address = `${root}/commit/${commits.tip}/components/${ids.list}/evidence`;
	await page.goto(address);
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
		await page.goto(address);
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
