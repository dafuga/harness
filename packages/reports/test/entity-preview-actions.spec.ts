import { expect, test } from '../../../test/support/browserTest';
import { capture, open, viewports, where } from './entityPreviewPage';
import { ids } from './entityUnits';

const page = { category: 'pages' as const, entity: ids.page };
for (const [name, size] of Object.entries(viewports)) {
	test(`a page card opens with one compact icon at ${name} width`, async ({ page: tab }) => {
		await tab.setViewportSize(size);
		await open(tab);
		const action = tab.getByRole('link', { name: 'Open page', exact: true });
		await expect(action).toBeVisible();
		await tab.evaluate(async () => {
			await document.fonts.ready;
			await Promise.all([...document.images].map((image) => image.decode()));
		});
		await capture(tab, `compact-page-${name}`);
		expect((await action.innerText()).trim()).toBe('');
		await expect(action).toHaveAttribute('title', 'Open page');
		await expect(action.locator('svg')).toHaveCount(1);
		expect(await action.boundingBox()).toMatchObject({ width: 36, height: 36 });
		await action.focus();
		await tab.keyboard.press('Enter');
		expect(await where(tab)).toEqual({ branch: 'feature/orders', commit: null, ...page });
	});

	test(`the console keeps a loaded revision responsive at ${name} width`, async ({
		page: tab
	}, info) => {
		await tab.setViewportSize(size);
		await open(tab, page, 'console');
		const content = await tab.locator('.ex-content').elementHandle();
		const start = await tab.evaluate(() => performance.now());
		await tab.getByRole('tab', { name: 'Used In', exact: true }).click();
		await expect(tab.getByRole('tabpanel', { name: /used in/i })).toBeVisible();
		const elapsed = (await tab.evaluate(() => performance.now())) - start;
		const retained = await content!.evaluate((node) => node.isConnected);
		const categoryStart = await tab.evaluate(() => performance.now());
		await tab
			.getByRole('navigation', { name: 'Harness categories' })
			.getByRole('link', { name: 'Functions', exact: true })
			.click();
		await expect(tab.getByRole('status').filter({ hasText: 'functions shown' })).toHaveText(
			'1001 of 1001 functions shown'
		);
		const categoryMs = (await tab.evaluate(() => performance.now())) - categoryStart;
		const searchStart = await tab.evaluate(() => performance.now());
		await tab.getByRole('searchbox', { name: 'Search functions' }).fill('generated 999');
		await expect(tab.getByRole('status').filter({ hasText: 'functions shown' })).toHaveText(
			'1 of 1001 functions shown'
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
