import { expect, test } from '../../../test/support/browserTest';
import { capture, open, viewports, where, reviewVisual, reviewStates } from './entityPreviewPage';
import { commits, ids } from './entityUnits';
import { reviewUsage } from './entityPreviewUsage';
const page = { category: 'pages' as const, entity: ids.page };
for (const [name, size] of Object.entries(viewports)) {
	test(`visual overviews lead with screenshots at ${name} width`, async ({ page: tab }) => {
		await tab.setViewportSize(size);
		for (const route of [page, { category: 'components' as const, entity: ids.list }]) {
			for (const commit of [null, commits.middle]) {
				if (route.category === 'components') await reviewStates(tab, route, commit, name);
				await reviewVisual(tab, route, commit, name);
			}
		}
	});
	test(`usage stays in dedicated tabs at ${name} width`, async ({ page: tab }) => {
		await tab.setViewportSize(size);
		for (const [category, entity] of [
			['pages', ids.page],
			['components', ids.list],
			['functions', ids.filter],
			['services', ids.store],
			['configs', ids.settings]
		] as const) {
			for (const commit of [null, commits.middle])
				await reviewUsage(tab, { category, entity, commit }, name);
		}
	});
	test(`page cards show a title, screenshot and shared usage footer at ${name} width`, async ({
		page: tab
	}) => {
		await tab.setViewportSize(size);
		await open(tab);
		await tab.evaluate(async () => {
			await document.fonts.ready;
			await Promise.all([...document.images].map((image) => image.decode()));
		});
		await capture(tab, `compact-page-${name}`);
		const card = tab.getByRole('article', { name: 'Orders page', exact: true });
		await expect(card.getByRole('group', { name: 'Used In', exact: true })).toHaveText('Used In—');
		await expect(card.getByRole('heading', { name: 'Orders page', exact: true })).toBeVisible();
		await expect(card.locator('button, .hx-verdict, .ex-fact')).toHaveCount(0);
		const action = card.getByRole('link', { name: 'Open Orders page', exact: true });
		await expect(action).toHaveCount(1);
		await expect(action.getByRole('img')).toHaveAttribute(
			'src',
			'/media/ccccccc-default-desktop.png'
		);
		await action.focus();
		await tab.keyboard.press('Enter');
		expect(await where(tab)).toEqual({ branch: 'feature/orders', commit: null, ...page });
	});
	test(`the console keeps a loaded revision responsive at ${name} width`, async ({
		page: tab
	}, info) => {
		await tab.setViewportSize(size);
		await open(tab, page, 'console');
		await capture(tab, `quiet-console-${name}`);
		await expect(tab.locator('body')).not.toContainText('Older commits were left out');
		const content = await tab.locator('.ex-content').elementHandle();
		const start = await tab.evaluate(() => performance.now());
		await tab.getByRole('tab', { name: 'Uses', exact: true }).click();
		await expect(tab.getByRole('tabpanel', { name: /uses/i })).toBeVisible();
		const elapsed = (await tab.evaluate(() => performance.now())) - start;
		const retained = await content!.evaluate((node) => node.isConnected);
		const categoryStart = await tab.evaluate(() => performance.now());
		await tab
			.getByRole('navigation', { name: 'Harness categories' })
			.getByRole('link', { name: 'Helpers', exact: true })
			.click();
		await expect(tab.getByRole('status').filter({ hasText: 'helpers shown' })).toHaveText(
			'1003 of 1003 helpers shown'
		);
		const categoryMs = (await tab.evaluate(() => performance.now())) - categoryStart;
		const searchStart = await tab.evaluate(() => performance.now());
		await tab.getByRole('searchbox', { name: 'Search helpers' }).fill('generated 999');
		await expect(tab.getByRole('status').filter({ hasText: 'helpers shown' })).toHaveText(
			'1 of 1003 helpers shown'
		);
		const searchMs = (await tab.evaluate(() => performance.now())) - searchStart;
		await tab.evaluate(async () => {
			await document.fonts.ready;
		});
		await capture(tab, `responsive-console-${name}`);
		await info.attach('interaction-ms', {
			body: JSON.stringify({ tab: elapsed, category: categoryMs, search: searchMs }),
			contentType: 'application/json'
		});
		expect(retained, 'same-revision tabs retain loaded content').toBe(true);
		for (const duration of [elapsed, categoryMs, searchMs]) {
			expect(duration, 'same-revision interactions stay below 500 ms').toBeLessThan(500);
		}
	});
}
