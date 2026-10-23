import { testFile, sourceMetrics } from './entityPreviewFunctionSource';
import { expect as browserExpect, test } from '../../../test/support/browserTest';
import { capture, fits, open, viewports, where } from './entityPreviewPage';
import { commits, ids } from './entityUnits';
import { frameId } from './entityPreviewData';
import { sourceText } from './entitySourceFixture';
import { createHash } from 'node:crypto';
import type { Page } from '@playwright/test';

const kinds = [
	['Models', 'models', 'Order', 'app.model.order', 'src/models/orders/Order.ts'],
	['Helpers', 'functions', 'filterOrders', ids.filter, 'src/helpers/orders/filterOrders.ts'],
	['Pages', 'pages', 'Orders page', ids.page, 'src/routes/orders/+page.svelte'],
	['Components', 'components', 'OrderCard', ids.card, 'src/components/orders/OrderCard.ts'],
	['Layouts', 'layouts', 'OrderFrame', frameId, 'src/layouts/orders/OrderFrame.svelte'],
	['Configs', 'configs', 'orderSettings', ids.settings, 'src/configs/orders/orderSettings.ts'],
	['Services', 'services', 'OrderStore', ids.store, 'src/services/orders/OrderStore.ts']
] as const;
test.use({ actionTimeout: 3000 });
const expect = browserExpect.configure({ timeout: 2000 });
const phase = process.env.SCREENSHOT_LABEL ?? 'run';
async function fileLink(page: Page, path: string, commit: string) {
	const files = page.getByRole('list', { name: 'Source files', exact: true });
	const link = files.getByRole('link', { name: path, exact: true });
	await expect(link).toHaveAttribute(
		'href',
		`https://github.com/example/orders/blob/${commit}/${path.split('/').map(encodeURIComponent).join('/')}`
	);
	await expect(link).toHaveAttribute('target', '_blank');
	await expect(link, 'Source paths stay on one line').toHaveCSS('white-space', 'nowrap');
	await expect(link).toHaveAttribute('title', path);
	await expect(link, 'Source labels omit only the implied root').toHaveText(
		path.replace(/^src\/services\//, '')
	);
	const height = await link.locator('..').evaluate((row) => row.clientHeight);
	expect(height).toBeLessThanOrEqual(page.viewportSize()!.width > 480 ? 56 : 84);
	await expect(
		link.locator('..').getByRole('button', { name: `View code for ${path}`, exact: true })
	).toBeVisible();
	const bounds = (await link.locator('..').getByRole('button').boundingBox())!;
	expect(bounds.height, 'Code actions stay compact').toBeLessThanOrEqual(28);
	expect(bounds.width, 'Code actions stay compact').toBeLessThanOrEqual(110);
	await expect(page.getByText('Source ownership', { exact: true })).toHaveCount(0);
	await expect(page.getByText('Symbols', { exact: true })).toHaveCount(0);
	await expect(page.getByText('Execution targets', { exact: true })).toHaveCount(0);
}
async function historicalFile(
	page: Page,
	item: { category: (typeof kinds)[number][1]; id: string; path: string }
) {
	await open(
		page,
		{
			category: item.category,
			entity: item.id,
			commit: commits.middle,
			tab: 'source',
			...(item.category === 'functions' ? { helper: 'filterOrders' } : {})
		},
		'source'
	);
	await fileLink(page, item.path, commits.middle);
	await testFile(page, item.id, commits.middle);
	await page.getByRole('button', { name: `View code for ${item.path}`, exact: true }).click();
	await expect(page.getByRole('dialog').locator('pre')).toHaveText(
		sourceText(commits.middle, item.path)
	);
	await expect(page.getByRole('dialog').locator('pre')).not.toContainText(commits.tip);
	await page.getByRole('dialog').getByRole('button', { name: 'Close viewer', exact: true }).click();
	await expect(page.getByRole('dialog')).toHaveCount(0);
}
for (const [viewport, size] of Object.entries(viewports)) {
	for (const [label, category, name, id, path] of kinds) {
		test(`${label} code opens only from the detail Source tab at ${viewport} width`, async ({
			page
		}, info) => {
			await page.setViewportSize(size);
			await open(page, { category }, 'source');
			await page.evaluate(() => document.fonts.ready);
			await capture(page, `${phase}-source-catalog-${category}-${viewport}`);
			await expect(page.getByRole('button', { name: /^View code for / })).toHaveCount(0);
			await open(
				page,
				{ category, entity: id, ...(category === 'functions' ? { helper: name } : {}) },
				'source'
			);
			await expect(page.getByRole('button', { name: /^View code for / })).toHaveCount(0);
			await page.getByRole('tab', { name: 'Source', exact: true }).click();
			const address = await where(page);
			const title = category === 'functions' ? 'filterOrders' : name;
			const action = page.getByRole('button', { name: `View code for ${path}`, exact: true });
			await expect(
				page.locator('.ex-head').getByRole('button', { name: /^View code for / })
			).toHaveCount(0);
			await expect(page.locator('pre')).toHaveCount(0);
			await capture(page, `${phase}-source-action-${category}-${viewport}`, [
				'reports.component.harness-entity-source',
				'reports.component.source-file-list'
			]);
			await expect(action, 'Every source file has its own code action').toBeVisible();
			await fileLink(page, path, commits.tip);
			await testFile(page, id, commits.tip);
			if (category === 'functions')
				await expect(
					page.getByRole('list', { name: 'Source files', exact: true }).getByRole('link')
				).toHaveCount(1);
			const started = await page.evaluate(() => performance.now());
			await action.click();
			const dialog = page.getByRole('dialog', { name: `${title} · Source code` });
			await expect(dialog).toBeVisible();
			await expect(dialog.locator('pre')).toContainText(commits.tip);
			await expect(dialog.locator('pre')).toContainText('export const sourceRevision');
			await expect(dialog.locator('pre')).toContainText('<script>');
			await expect(dialog.getByText('ccccccc', { exact: true })).toBeVisible();
			expect(await where(page)).toEqual(address);
			expect(await fits(page)).toBe(true);
			await capture(page, `${phase}-source-open-${category}-${viewport}`);
			await sourceMetrics(page, info, started);
			await page.keyboard.press('Escape');
			await expect(dialog).toHaveCount(0);
			await expect(action).toBeFocused();
			expect(await where(page)).toEqual(address);
			await page
				.getByRole('tab', { name: category === 'pages' ? 'Models' : 'Contract', exact: true })
				.click();
			await expect(page.getByRole('button', { name: /^View code for / })).toHaveCount(0);
			await historicalFile(page, { category, id, path });
		});
	}
}

test('source file selection and closing retain the detail Source tab', async ({ page }) => {
	await open(page, { category: 'services', entity: ids.store, tab: 'source' }, 'source');
	const address = await where(page);
	await fileLink(page, 'src/services/orders/Order types #é.ts', commits.tip);
	await page
		.getByRole('button', { name: 'View code for src/services/orders/Order types #é.ts' })
		.click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByRole('combobox', { name: 'Source file' })).toHaveValue(
		'src/services/orders/Order types #é.ts'
	);
	await expect(dialog.locator('pre')).toHaveText(
		sourceText(commits.tip, 'src/services/orders/Order types #é.ts')
	);
	await page.keyboard.press('Escape');
	expect(await where(page)).toEqual(address);
	await expect(
		page.getByRole('button', { name: 'View code for src/services/orders/Order types #é.ts' })
	).toBeFocused();
});

test('Source opens file contents in a modal and older histories state an explicit gap', async ({
	page
}) => {
	const route = {
		category: 'functions' as const,
		entity: ids.filter,
		tab: 'source' as const,
		helper: 'filterOrders'
	};
	await open(page, { ...route, commit: commits.middle }, 'source');
	await expect(page.locator('pre')).toHaveCount(0);
	await page
		.getByRole('button', {
			name: 'View code for src/helpers/orders/filterOrders.ts',
			exact: true
		})
		.click();
	await expect(page.getByRole('dialog').locator('pre')).toHaveText(
		sourceText(commits.middle, 'src/helpers/orders/filterOrders.ts')
	);
	await open(page, route);
	await page
		.getByRole('button', {
			name: 'View code for src/functions/filterOrders.ts',
			exact: true
		})
		.click();
	await expect(
		page
			.getByRole('dialog')
			.getByText('Source contents are not recorded for this revision.', { exact: true })
	).toBeVisible();
	await expect(page.locator('pre')).toHaveCount(0);
});

test('a delayed previous source read cannot replace the selected file', async ({ page }) => {
	await open(page, { category: 'services', entity: ids.store, tab: 'source' }, 'source');
	const previous = sourceText(commits.tip, 'src/services/orders/OrderStore.ts');
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
	await page
		.getByRole('button', { name: 'View code for src/services/orders/OrderStore.ts' })
		.click();
	await requested;
	const dialog = page.getByRole('dialog');
	await dialog
		.getByRole('combobox', { name: 'Source file' })
		.selectOption('src/services/orders/Order types #é.ts');
	const expected = sourceText(commits.tip, 'src/services/orders/Order types #é.ts');
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
