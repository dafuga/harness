import type { Locator, Page } from '@playwright/test';
import { expect } from '../../../test/support/browserTest';
import { capture, fits, open, where } from './entityPreviewPage';
import { commits, ids } from './entityUnits';

/** Private functions stay reachable from their owner at the tip and a historical commit. */
export async function reviewPrivateFunctions(page: Page, viewport: string): Promise<void> {
	for (const commit of [null, commits.middle]) {
		await open(page, { category: 'components', entity: ids.list, tab: 'uses', commit }, 'helpers');
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
	for (const commit of [null, commits.middle]) {
		await open(page, { category: 'functions', commit }, 'helpers');
		await page.evaluate(async () => {
			await document.fonts.ready;
		});
		await capture(page, `helper-used-in-${commit ? 'commit' : 'tip'}-${viewport}`);
		const card = page.getByRole('article');
		const usage = card.getByRole('group', { name: 'Used In', exact: true });
		await expect(usage, 'helper cards expose their consumers').toBeVisible();
		await expect(usage.getByRole('link')).toHaveText(['OrderList', 'OrderStore', 'Order']);
		for (const kind of ['Components', 'Services', 'Models'])
			await expect(usage.getByRole('list', { name: kind, exact: true })).toBeVisible();
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
			['Order', 'models', 'app.model.order']
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
/** Source navigation stays bound to the selected repository and full commit. */
export async function reviewHelperSource(page: Page, viewport: string): Promise<void> {
	const filter = { category: 'functions' as const, entity: ids.filter };
	for (const commit of [null, commits.middle]) {
		await open(page, { ...filter, commit });
		await expect(page.getByRole('link', { name: 'Details', exact: true })).toHaveCount(0);
		await page.getByRole('tab', { name: 'Source', exact: true }).click();
		await capture(page, `github-source-${commit ? 'commit' : 'tip'}-${viewport}`);
		const file = 'src/functions/filterOrders.ts';
		await expect(
			page.getByRole('link', { name: file, exact: true }),
			'GitHub source links'
		).toHaveAttribute(
			'href',
			`https://github.com/example/orders/blob/${commit ?? commits.tip}/${file}`
		);
		await expect(page.getByText(/Source ownership|Execution targets|Identity /)).toHaveCount(0);
		expect(await fits(page)).toBe(true);
		await page.getByRole('tab', { name: 'Overview', exact: true }).click();
		expect(await where(page)).toEqual({ branch: 'feature/orders', commit, ...filter });
	}
}
export { reviewUsageCards } from './entityPreviewUsage';

export { reviewServiceCard } from './entityPreviewUsage';
