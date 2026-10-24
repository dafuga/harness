import { expect, test } from '../../../test/support/browserTest';
import type { Locator, Page } from '@playwright/test';
import { capture, fits, open, ready, viewports, where } from './entityPreviewPage';
import { commits, ids } from './entityUnits';
const modelUnits = [
	'reports.component.explorer-ui-explorer-module-card',
	'reports.component.harness-entity-relations'
];
const modelPanes = [
	'reports.component.harness-entity-header',
	'reports.component.harness-entity-sections'
];

/** Code and short example labels stay readable; any wider table remains internally scrollable. */
async function readableTables(scope: Locator): Promise<void> {
	for (const table of await scope.getByRole('table').all()) {
		for (const item of await table.locator('tbody th, tbody td code, tbody .example > i').all()) {
			const geometry = await item.evaluate((node) => {
				const range = document.createRange();
				range.selectNodeContents(node);
				return {
					lines: range.getClientRects().length,
					fitsCell: range.getBoundingClientRect().width <= node.closest('th, td')!.clientWidth + 1
				};
			});
			expect.soft(geometry, `Readable complete table text: ${await item.textContent()}`).toEqual({
				lines: 1,
				fitsCell: true
			});
		}
		const contained = await table.evaluate((node) => {
			if (node.getBoundingClientRect().right <= innerWidth + 1) return true;
			for (let frame = node.parentElement; frame; frame = frame.parentElement)
				if (['auto', 'scroll'].includes(getComputedStyle(frame).overflowX))
					return (
						frame.scrollWidth > frame.clientWidth &&
						frame.getBoundingClientRect().right <= innerWidth + 1
					);
			return false;
		});
		expect
			.soft(contained, 'Wide tables scroll inside their frame rather than the document')
			.toBe(true);
	}
}

async function reviewModelPane(page: Page, contract: boolean): Promise<void> {
	const markers = ['harness-entity-header', 'harness-entity-sections'];
	if (contract) markers.push('entity-contract', 'contract-table');
	for (const marker of markers)
		await expect(page.locator(`[data-harness-component="${marker}"]`).first()).toBeVisible();
	if (!contract) return;
	await expect(
		page.getByRole('region', { name: / method$/ }).getByRole('heading', { level: 3 })
	).toHaveText([
		'create(input)',
		'findBy(fields)',
		'find(id)',
		'update(id, input)',
		'delete(id)',
		'initialize(adapter)'
	]);
	const heading = page
		.getByRole('region', { name: 'create method', exact: true })
		.getByRole('heading');
	const nameColor = await heading
		.getByText('create', { exact: true })
		.evaluate((node) => getComputedStyle(node).color);
	const parameterColor = await heading
		.getByText('input', { exact: true })
		.evaluate((node) => getComputedStyle(node).color);
	expect(nameColor, 'method and parameter names have distinct text colors').not.toBe(
		parameterColor
	);
}

async function modelExample(page: Page): Promise<void> {
	const update = page.getByRole('region', { name: 'update method', exact: true });
	const button = update.getByRole('button', { name: 'View example for id', exact: true });
	await button.press('Enter');
	await expect(page.getByRole('dialog')).toContainText('"example"');
	await page.keyboard.press('Escape');
	await expect(button).toBeFocused();
}

test('component contracts expose Props and keep verification states on States', async ({
	page: tab
}) => {
	await tab.setViewportSize(viewports.desktop);
	const route = { category: 'components' as const, entity: ids.list };
	await open(tab, { ...route, tab: 'contract' }, 'states');
	await ready(tab);
	const contract = tab.getByRole('tabpanel', { name: 'OrderList contract', exact: true });
	await expect(contract).toBeVisible();
	await expect(contract).not.toContainText(/\bstates?\b/i);
	await capture(tab, 'component-contract-props-no-output-desktop');
	const props = contract.getByRole('table', { name: 'Props', exact: true });
	await expect(props).toBeVisible();
	await expect(props.locator('tbody tr')).toHaveCount(2);
	await expect(contract.getByRole('table', { name: 'Inputs', exact: true })).toHaveCount(0);
	await expect(contract.getByRole('table', { name: 'Outputs', exact: true })).toHaveCount(0);
	await expect(contract.getByRole('table', { name: 'Errors', exact: true })).toHaveCount(0);
	await expect(contract).not.toContainText('No errors declared.');
	await expect(contract).toContainText('Orders');
	await expect(contract).toContainText('Search text');

	await open(tab, { ...route, tab: 'states' }, 'states');
	await ready(tab);
	const states = tab.getByRole('tabpanel', { name: 'OrderList states', exact: true });
	await expect(states).toContainText('Default');
	await expect(states).toContainText('Empty');
	expect(await where(tab)).toMatchObject({ ...route, tab: 'states' });
});

for (const [viewport, size] of Object.entries(viewports)) {
	test(`model detail separates method contracts and table structure at ${viewport} width`, async ({
		page
	}) => {
		await page.setViewportSize(size);
		for (const commit of [null, commits.middle]) {
			const route = { category: 'models' as const, entity: 'app.model.order', commit };
			await open(page, { ...route, tab: 'contract' }, 'groups');
			await ready(page);
			await reviewModelPane(page, true);
			await capture(page, `model-contract-${commit ? 'commit' : 'tip'}-${viewport}`, [
				'reports.component.entity-contract',
				'reports.component.contract-table',
				...modelPanes
			]);
			for (const method of ['initialize', 'create', 'findBy', 'find', 'update', 'delete'])
				await expect(
					page.getByRole('region', { name: `${method} method`, exact: true })
				).toBeVisible();
			await expect(page.getByRole('table', { name: 'Outputs', exact: true })).toHaveCount(0);
			await expect(page.getByRole('table', { name: 'Errors', exact: true })).toHaveCount(0);
			await readableTables(page.getByRole('tabpanel', { name: 'Order contract', exact: true }));
			await modelExample(page);
			await page.getByRole('tab', { name: 'Table', exact: true }).click();
			await ready(page);
			await reviewModelPane(page, false);
			await capture(page, `model-table-${commit ? 'commit' : 'tip'}-${viewport}`, modelPanes);
			await expect(
				page.getByRole('heading', { name: commit ? 'purchases' : 'orders', exact: true })
			).toBeVisible();
			await expect(page.getByRole('cell', { name: 'account_id', exact: true })).toBeVisible();
			await readableTables(page.getByRole('tabpanel', { name: 'Order table', exact: true }));
			expect(await where(page)).toMatchObject({ ...route, tab: 'table' });
			expect(await fits(page)).toBe(true);
			await page.reload();
			await ready(page);
			await expect(page.getByRole('cell', { name: 'account_id', exact: true })).toBeVisible();
		}
	});
	test(`page sections show used models instead of a contract at ${viewport} width`, async ({
		page: tab
	}) => {
		await tab.setViewportSize(size);
		for (const commit of [null, commits.middle]) {
			await open(tab, { category: 'pages', entity: ids.page, commit }, 'groups');
			await capture(
				tab,
				`page-models-${process.env.SCREENSHOT_LABEL ?? 'run'}-${viewport}-${commit ? 'commit' : 'tip'}`,
				['reports.component.harness-entity-overview']
			);
			await expect(tab.getByRole('tab', { name: 'Contract', exact: true })).toHaveCount(0);
			await tab.getByRole('tab', { name: 'Models', exact: true }).click();
			const panel = tab.getByRole('tabpanel', { name: 'Orders page models', exact: true });
			await expect(panel).toBeVisible();
			await capture(
				tab,
				`page-models-content-${process.env.SCREENSHOT_LABEL ?? 'run'}-${viewport}-${commit ? 'commit' : 'tip'}`,
				modelUnits
			);
			const card = panel.getByRole('article', { name: 'Order', exact: true });
			await expect(card).toHaveAttribute(
				'data-harness-component',
				'explorer-ui-explorer-module-card'
			);
			await expect(card.getByRole('group', { name: 'Used In', exact: true })).toBeVisible();
			await expect(panel.getByRole('article')).toHaveCount(1);
			await expect(panel).not.toContainText('Order.types');
			const consumer = card.getByRole('link', { name: 'OrderStore', exact: true });
			await consumer.hover();
			await expect(tab.getByRole('tooltip', { name: 'Preview of OrderStore' })).toBeVisible();
			await tab.keyboard.press('Escape');
			const model = panel.getByRole('link', { name: 'Order', exact: true });
			await expect(model).toBeVisible();
			await model.click();
			expect(await where(tab)).toMatchObject({
				category: 'models',
				entity: 'app.model.order',
				commit
			});
		}
		await open(
			tab,
			{ category: 'pages', entity: ids.page, commit: commits.first, tab: 'models' },
			'groups'
		);
		await expect(
			tab.getByRole('tabpanel', { name: 'Orders page models', exact: true })
		).toContainText('No data models are recorded for this page.');
	});
}
