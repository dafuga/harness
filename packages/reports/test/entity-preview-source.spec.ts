import { expect, test } from '../../../test/support/browserTest';
import { capture, fits, open, viewports, where } from './entityPreviewPage';
import { commits, ids } from './entityUnits';
import { frameId } from './entityPreviewData';
import { sourceText } from './entitySourceFixture';
import { createHash } from 'node:crypto';

const kinds = [
	['Models', 'models', 'Order', 'app.model.order'],
	['Helpers', 'functions', 'filterOrders', ids.filter],
	['Pages', 'pages', 'Orders page', ids.page],
	['Components', 'components', 'Order card', ids.card],
	['Shells', 'shells', 'Order frame', frameId],
	['Configs', 'configs', 'Order settings', ids.settings],
	['Services', 'services', 'Order store', ids.store]
] as const;
const phase = process.env.SCREENSHOT_LABEL ?? 'run';

for (const [viewport, size] of Object.entries(viewports)) {
	for (const [label, category, name, id] of kinds) {
		test(`${label} source opens from its catalog at ${viewport} width`, async ({ page }, info) => {
			await page.setViewportSize(size);
			await open(page, { category }, 'source');
			const address = await where(page);
			const action = page.getByRole('button', { name: `View code for ${name}`, exact: true });
			await page.evaluate(() => document.fonts.ready);
			await capture(page, `${phase}-source-action-${category}-${viewport}`);
			await expect(action, 'every catalog type exposes actual source').toBeVisible();
			const started = await page.evaluate(() => performance.now());
			await action.click();
			const dialog = page.getByRole('dialog', { name: `${name} · Source code` });
			await expect(dialog).toBeVisible();
			await expect(dialog.locator('pre')).toContainText(commits.tip);
			await expect(dialog.locator('pre')).toContainText('export const sourceRevision');
			await expect(dialog.locator('pre')).toContainText('<script>');
			await expect(dialog.getByText('ccccccc', { exact: true })).toBeVisible();
			expect(await where(page)).toEqual(address);
			expect(await fits(page)).toBe(true);
			await capture(page, `${phase}-source-open-${category}-${viewport}`);
			await info.attach('source-view-metrics', {
				body: JSON.stringify(
					await page.evaluate(
						(start) => ({
							openMs: performance.now() - start,
							pageHeapBytes:
								(performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
									?.usedJSHeapSize ?? null
						}),
						started
					)
				),
				contentType: 'application/json'
			});
			await page.keyboard.press('Escape');
			await expect(dialog).toHaveCount(0);
			await expect(action).toBeFocused();
			expect(await where(page)).toEqual(address);
			await open(page, { category, entity: id, commit: commits.middle }, 'source');
			await page
				.getByRole('button', {
					name: `View code for ${category === 'functions' ? 'Filter orders' : name}`,
					exact: true
				})
				.click();
			await expect(page.getByRole('dialog').locator('pre')).toContainText(commits.middle);
			await expect(page.getByRole('dialog').locator('pre')).not.toContainText(commits.tip);
			await page
				.getByRole('dialog')
				.getByRole('button', { name: 'Close viewer', exact: true })
				.click();
			await expect(page.getByRole('dialog')).toHaveCount(0);
		});
	}
}

test('source file selection and closing retain the filtered collection', async ({ page }) => {
	await open(page, { category: 'services' }, 'source');
	await page.getByRole('searchbox', { name: 'Search services' }).fill('Order store');
	await page.getByRole('button', { name: 'View code for Order store' }).click();
	const dialog = page.getByRole('dialog');
	await dialog
		.getByRole('combobox', { name: 'Source file' })
		.selectOption('src/services/OrderStore.types.ts');
	await expect(dialog.locator('pre')).toHaveText(
		sourceText(commits.tip, 'src/services/OrderStore.types.ts')
	);
	await page.keyboard.press('Escape');
	await expect(page.getByRole('searchbox', { name: 'Search services' })).toHaveValue('Order store');
});

test('the Source tab shows file contents and older histories state an explicit gap', async ({
	page
}) => {
	const route = { category: 'functions' as const, entity: ids.filter, tab: 'source' as const };
	await open(page, { ...route, commit: commits.middle }, 'source');
	await expect(page.locator('pre')).toHaveText(
		sourceText(commits.middle, 'src/functions/filterOrders.ts')
	);
	await open(page, route);
	await expect(
		page.getByText('Source contents are not recorded for this revision.', { exact: true })
	).toBeVisible();
	await expect(page.locator('pre')).toHaveCount(0);
});

test('a delayed previous source read cannot replace the selected file', async ({ page }) => {
	await open(page, { category: 'services' }, 'source');
	const previous = sourceText(commits.tip, 'src/services/OrderStore.ts');
	const hash = createHash('sha256').update(previous).digest('hex');
	let release = () => {};
	const held = new Promise<void>((done) => {
		release = done;
	});
	await page.route(`**/media/${hash}.txt`, async (route) => {
		await held;
		await route.fulfill({ contentType: 'text/plain', body: previous });
	});
	const requested = page.waitForRequest(`**/media/${hash}.txt`);
	await page.getByRole('button', { name: 'View code for Order store' }).click();
	await requested;
	const dialog = page.getByRole('dialog');
	await dialog
		.getByRole('combobox', { name: 'Source file' })
		.selectOption('src/services/OrderStore.types.ts');
	const expected = sourceText(commits.tip, 'src/services/OrderStore.types.ts');
	await expect(dialog.locator('pre')).toHaveText(expected);
	const answered = page.waitForResponse(`**/media/${hash}.txt`);
	release();
	await (await answered).finished();
	await page.evaluate(
		() =>
			new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))
	);
	await expect(dialog.locator('pre')).toHaveText(expected);
});
