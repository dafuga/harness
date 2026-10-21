import { expect, test } from '../../../test/support/browserTest';
import { capture, fits, open, viewports, where } from './entityPreviewPage';
import { commits, ids } from './entityUnits';
import { frameId } from './entityPreviewData';
import { sourceText } from './entitySourceFixture';
import { createHash } from 'node:crypto';
import type { Page, TestInfo } from '@playwright/test';

const kinds = [
	['Models', 'models', 'Order', 'app.model.order', 'src/models/Order.ts'],
	['Helpers', 'functions', 'filterOrders', ids.filter, 'src/functions/filterOrders.ts'],
	['Pages', 'pages', 'Orders page', ids.page, 'src/routes/orders/+page.svelte'],
	['Components', 'components', 'Order card', ids.card, 'src/components/OrderCard.ts'],
	['Shells', 'shells', 'Order frame', frameId, 'src/shells/OrderFrame.svelte'],
	['Configs', 'configs', 'Order settings', ids.settings, 'src/configs/orderSettings.ts'],
	['Services', 'services', 'Order store', ids.store, 'src/services/OrderStore.ts']
] as const;
const phase = process.env.SCREENSHOT_LABEL ?? 'run';

async function sourceMetrics(page: Page, info: TestInfo, started: number) {
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
}

async function fileLink(page: Page, path: string, commit: string) {
	const files = page.getByRole('list', { name: 'Source files', exact: true });
	const link = files.getByRole('link', { name: path, exact: true });
	await expect(link).toHaveAttribute(
		'href',
		`https://github.com/fixture/orders/blob/${commit}/${path.split('/').map(encodeURIComponent).join('/')}`
	);
	await expect(link).toHaveAttribute('target', '_blank');
	await expect(
		link.locator('..').getByRole('button', { name: `View code for ${path}`, exact: true })
	).toBeVisible();
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
		{ category: item.category, entity: item.id, commit: commits.middle, tab: 'source' },
		'source'
	);
	await fileLink(page, item.path, commits.middle);
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
			await open(page, { category, entity: id }, 'source');
			await expect(page.getByRole('button', { name: /^View code for / })).toHaveCount(0);
			await page.getByRole('tab', { name: 'Source', exact: true }).click();
			const address = await where(page);
			const title = category === 'functions' ? 'Filter orders' : name;
			const action = page.getByRole('button', { name: `View code for ${path}`, exact: true });
			await expect(
				page.locator('.ex-head').getByRole('button', { name: /^View code for / })
			).toHaveCount(0);
			await expect(page.locator('pre')).toHaveCount(0);
			await capture(page, `${phase}-source-action-${category}-${viewport}`);
			await fileLink(page, path, commits.tip);
			await expect(action, 'Every source file has its own code action').toBeVisible();
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
			await page.getByRole('tab', { name: 'Contract', exact: true }).click();
			await expect(page.getByRole('button', { name: /^View code for / })).toHaveCount(0);
			await historicalFile(page, { category, id, path });
		});
	}
}

test('source file selection and closing retain the detail Source tab', async ({ page }) => {
	await open(page, { category: 'services', entity: ids.store, tab: 'source' }, 'source');
	const address = await where(page);
	await fileLink(page, 'src/services/Order types #é.ts', commits.tip);
	await page.getByRole('button', { name: 'View code for src/services/Order types #é.ts' }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByRole('combobox', { name: 'Source file' })).toHaveValue(
		'src/services/Order types #é.ts'
	);
	await expect(dialog.locator('pre')).toHaveText(
		sourceText(commits.tip, 'src/services/Order types #é.ts')
	);
	await page.keyboard.press('Escape');
	expect(await where(page)).toEqual(address);
	await expect(
		page.getByRole('button', { name: 'View code for src/services/Order types #é.ts' })
	).toBeFocused();
});

test('Source opens file contents in a modal and older histories state an explicit gap', async ({
	page
}) => {
	const route = { category: 'functions' as const, entity: ids.filter, tab: 'source' as const };
	await open(page, { ...route, commit: commits.middle }, 'source');
	await expect(page.locator('pre')).toHaveCount(0);
	await page
		.getByRole('button', { name: 'View code for src/functions/filterOrders.ts', exact: true })
		.click();
	await expect(page.getByRole('dialog').locator('pre')).toHaveText(
		sourceText(commits.middle, 'src/functions/filterOrders.ts')
	);
	await open(page, route);
	await page
		.getByRole('button', { name: 'View code for src/functions/filterOrders.ts', exact: true })
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
	await page.getByRole('button', { name: 'View code for src/services/OrderStore.ts' }).click();
	await requested;
	const dialog = page.getByRole('dialog');
	await dialog
		.getByRole('combobox', { name: 'Source file' })
		.selectOption('src/services/Order types #é.ts');
	const expected = sourceText(commits.tip, 'src/services/Order types #é.ts');
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
