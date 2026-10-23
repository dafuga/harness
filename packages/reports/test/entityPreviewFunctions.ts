import type { Locator, Page } from '@playwright/test';
import { expect } from '../../../test/support/browserTest';
import { capture, fits, open, where } from './entityPreviewPage';
import { commits, ids } from './entityUnits';
import { reviewNamedCallers } from './entityPreviewFunctionSource';

/** Private functions stay reachable from their owner at the tip and a historical commit. */
export async function reviewPrivateFunctions(page: Page, viewport: string): Promise<void> {
	for (const commit of [null, commits.middle]) {
		await open(page, { category: 'components', entity: ids.list, tab: 'uses', commit }, 'helpers');
		await capture(
			page,
			`${process.env.SCREENSHOT_LABEL ?? 'run'}-private-card-${commit ? 'commit' : 'tip'}-${viewport}`,
			[
				'reports.component.harness-entity-relations',
				'reports.component.explorer-ui-explorer-module-card',
				'reports.component.explorer-catalog-items'
			]
		);
		const card = page.getByRole('article', { name: 'single', exact: true });
		await expect(card, 'Private dependencies reuse the canonical module card').toHaveAttribute(
			'data-harness-component',
			'explorer-ui-explorer-module-card'
		);
		await expect(card.getByRole('group', { name: 'Used In', exact: true })).toBeVisible();
		await page
			.getByRole('region', { name: 'Uses', exact: true })
			.getByRole('link', { name: 'single', exact: true })
			.click();
		await page.evaluate(async () => {
			await document.fonts.ready;
		});
		await capture(
			page,
			`${process.env.SCREENSHOT_LABEL ?? 'run'}-private-function-${commit ? 'commit' : 'tip'}-${viewport}`
		);
		const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
		await expect(breadcrumb, 'Private functions have no Helpers breadcrumb').not.toContainText(
			'Helpers'
		);
		await expect(breadcrumb.getByRole('link', { name: 'OrderList', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'single', exact: true })).toBeVisible();
		await page.getByRole('tab', { name: 'Examples', exact: true }).click();
		await expect(page.getByRole('tabpanel', { name: 'single examples' })).toBeVisible();
		await page.getByRole('tab', { name: 'Source', exact: true }).click();
		await expect(page.getByRole('tabpanel', { name: 'single source' })).toBeVisible();
		await page.getByRole('tab', { name: 'History', exact: true }).click();
		await expect(breadcrumb).not.toContainText('Helpers');
		expect(await where(page)).toMatchObject({
			entity: 'function.single',
			commit,
			section: 'history'
		});
		expect(await fits(page)).toBe(true);
	}
}
/** A shared helper card opens the same callable's contract without extra detail panels. */
export async function reviewHelperCard(page: Page, cards: Locator): Promise<void> {
	await expect(cards.first(), 'function cards omit detail panels').not.toContainText(
		/Contract|Inputs|Output|Used by|View tests|Shared|Changed/
	);
	await expect(cards.locator('.hx-verdict')).toHaveCount(0);
	await expect(cards.locator('code'), 'function cards show example calls').toHaveText(
		'filterOrders(orders, "SERVICE")'
	);
	await expect(cards.locator('h2, p, img')).toHaveCount(0);
	await expect(cards.locator('svg'), 'function cards have no arrow').toHaveCount(0);
	const action = cards.getByRole('link', { name: 'filterOrders(orders, "SERVICE")', exact: true });
	await expect(action).toHaveCount(1);
	await action.press('Enter');
	expect(await where(page)).toMatchObject({
		category: 'functions',
		entity: ids.filter,
		commit: null
	});
	await page.getByRole('tab', { name: 'Contract', exact: true }).click();
	await expect(page.getByRole('table', { name: 'Parameters', exact: true })).toBeVisible();
}

/** Consumer links are limited to three eligible units and retain current or selected-commit scope. */
export async function reviewHelperUsage(page: Page, viewport: string): Promise<void> {
	await reviewNamedCallers(page, viewport);
	for (const commit of [null, commits.middle]) {
		await open(page, { category: 'functions', commit }, 'helpers');
		await page.evaluate(async () => {
			await document.fonts.ready;
		});
		await capture(page, `helper-used-in-${commit ? 'commit' : 'tip'}-${viewport}`);
		const card = page.getByRole('article');
		const usage = card.getByRole('group', { name: 'Used In', exact: true });
		await expect(usage, 'helper cards expose their consumers').toBeVisible();
		await expect(usage.getByRole('link')).toHaveText(['Orders page', 'OrderList', 'OrderStore']);
		await expect(usage, 'Four eligible consumers retain the overflow indicator').toContainText('…');
		for (const kind of ['Components', 'Services', 'Models'])
			await expect(usage.getByRole('list', { name: kind, exact: true })).toHaveCount(0);
		await reviewConsumerPreview(page, usage, commit, viewport);
		const sizes = await card.evaluate((node) => [
			parseFloat(getComputedStyle(node.querySelector('code')!).fontSize),
			parseFloat(getComputedStyle(node.querySelector('[aria-label="Used In"]')!).fontSize)
		]);
		expect(sizes[1], 'usage is smaller than the function call').toBeLessThan(sizes[0]);
		expect(await fits(page)).toBe(true);
		for (const [label, category, entity] of [
			['OrderList', 'components', ids.list],
			['OrderStore', 'services', ids.store],
			['Orders page', 'pages', ids.page]
		] as const) {
			await page
				.getByRole('group', { name: 'Used In', exact: true })
				.getByRole('link', { name: label, exact: true })
				.press('Enter');
			expect(await where(page)).toMatchObject({
				branch: 'feature/orders',
				commit,
				category,
				entity
			});
			await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible();
			await open(page, { category: 'functions', commit }, 'helpers');
		}
	}
}
async function reviewConsumerPreview(
	page: Page,
	usage: Locator,
	commit: string | null,
	viewport: string
): Promise<void> {
	const consumer = usage.getByRole('link', { name: 'OrderList', exact: true });
	await consumer.hover();
	await capture(page, `usage-preview-${commit ? 'commit' : 'tip'}-${viewport}`);
	const preview = page.getByRole('tooltip', { name: 'Preview of OrderList', exact: true });
	await expect(preview, 'consumer links show screenshot previews').toBeVisible();
	const image = preview.getByRole('img', { name: 'Screenshot of OrderList', exact: true });
	await expect(image).toHaveAttribute(
		'src',
		`/media/${(commit ?? commits.tip).slice(0, 7)}-default-desktop.png`
	);
	await expect(image).toHaveJSProperty('naturalWidth', 1440);
	await preview.hover();
	await expect(preview).toBeVisible();
	expect(await fits(page)).toBe(true);
	await page.keyboard.press('Escape');
	await expect(preview).toHaveCount(0);
	await consumer.focus();
	await expect(preview, 'keyboard focus shows the same preview').toBeVisible();
	await page.keyboard.press('Escape');
	await expect(preview).toHaveCount(0);
	const missing = usage.getByRole('link', { name: 'OrderStore', exact: true });
	await missing.hover();
	await capture(page, `nonvisual-preview-${commit ? 'commit' : 'tip'}-${viewport}`);
	const service = page.getByRole('tooltip', { name: 'Preview of OrderStore', exact: true });
	await expect(service.locator('code')).toHaveText('OrderStore');
	await expect(service).not.toContainText('No screenshot');
	await expect(service.locator('img')).toHaveCount(0);
	await page.mouse.move(1, 1);
}
export { reviewHelperSource } from './entityPreviewFunctionSource';
export { reviewUsageCards } from './entityPreviewUsage';

export { reviewServiceCard } from './entityPreviewUsage';

/** Folder titles follow the selected revision across contract and history tabs. */
export async function reviewServiceFolders(page: Page, viewport: string): Promise<void> {
	const service = { category: 'services' as const, entity: ids.store };
	for (const commit of [null, commits.first]) {
		await open(page, { ...service, commit, tab: 'contract' }, 'groups');
		const group = commit ? 'Purchases' : 'Orders';
		const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
		await capture(page, `folder-contract-${commit ? 'historical' : 'current'}-${viewport}`, [
			'reports.component.harness-entity-header'
		]);
		await expect
			.soft(crumbs.getByRole('listitem'))
			.toHaveText(['Services', group, 'OrderStore'], { timeout: 500 });
		await page.getByRole('tab', { name: 'History', exact: true }).click();
		await capture(page, `folder-history-${commit ? 'historical' : 'current'}-${viewport}`, [
			'reports.component.harness-entity-header'
		]);
		await expect
			.soft(crumbs.getByRole('listitem'))
			.toHaveText(['Services', group, 'OrderStore', 'History'], { timeout: 500 });
	}
	await open(page, service);
	await expect(
		page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('listitem')
	).toHaveText(['Services', 'OrderStore'], { timeout: 500 });
}

/** Helper source folders stay consistent between catalog and selected-callable breadcrumbs. */
export async function helperFolders(page: Page, viewport: string) {
	for (const [commit, title] of [
		[commits.middle, 'Strings'],
		[commits.first, 'Words']
	]) {
		await open(page, { category: 'functions', commit }, 'groups');
		await capture(page, `helper-folder-list-${commit.slice(0, 7)}-${viewport}`);
		await expect
			.soft(
				page.getByRole('heading', { name: new RegExp(`^${title} 1$`), level: 2 }),
				'Helper folder follows callable source'
			)
			.toBeVisible();
		await page.getByRole('link', { name: 'plural(2, "item")', exact: true }).click();
		await capture(page, `helper-folder-detail-${commit.slice(0, 7)}-${viewport}`, [
			'reports.component.harness-entity-frame',
			'reports.component.harness-entity-header',
			'reports.component.harness-entity-sections'
		]);
		await expect(
			page.getByRole('navigation', { name: 'Breadcrumb' }),
			'Helper folder follows callable source'
		).toContainText(title);
		await page.reload();
		await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText(title);
	}
}
