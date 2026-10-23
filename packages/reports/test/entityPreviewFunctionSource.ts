import { recordCapture } from '../../../src/utils/record-capture/recordCapture';
import { sourceText, sourceTestPath } from './entitySourceFixture';
import type { Page, TestInfo } from '@playwright/test';
import { expect } from '../../../test/support/browserTest';
import { capture, fits, open, where } from './entityPreviewPage';
import { commits, ids } from './entityUnits';

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

/** Private named callers retain callable and revision identity without entering the collection. */
export async function reviewNamedCallers(page: Page, viewport: string): Promise<void> {
	const units = [
		'reports.component.explorer-usage',
		'reports.component.explorer-usage-link',
		'reports.component.harness-explorer-catalog-screen'
	];
	for (const variant of ['named-callers', 'sibling-callers'] as const) {
		for (const commit of [null, commits.middle]) {
			await open(page, { category: 'functions', commit }, variant);
			const cards = page.getByRole('article');
			await expect(cards, 'Private callers never become public helper cards').toHaveCount(1);
			const usage = cards.getByRole('group', { name: 'Used In', exact: true });
			await expect(usage.getByRole('link')).toHaveText(['firstCall', 'secondCall', 'thirdCall']);
			await expect(usage).toContainText('…');
			await expect(usage).not.toContainText('fourthCall');
			await capture(page, `${variant}-${commit ? 'commit' : 'tip'}-${viewport}`, units);
			await usage.getByRole('link', { name: 'firstCall', exact: true }).hover();
			const preview = page.getByRole('tooltip', { name: 'Preview of firstCall', exact: true });
			await expect(preview).toBeVisible();
			await capture(page, `${variant}-preview-${commit ? 'commit' : 'tip'}-${viewport}`, units);
			await expect(
				preview.locator('code'),
				'Preview and destination identify the same caller'
			).toHaveText('firstCall');
			await usage.getByRole('link', { name: 'firstCall', exact: true }).press('Enter');
			expect(await where(page)).toMatchObject({
				branch: 'feature/orders',
				commit,
				category: 'functions',
				helper: 'firstCall',
				entity: variant === 'sibling-callers' ? ids.filter : 'function.named-users'
			});
			await expect(page.getByRole('heading', { name: 'firstCall', exact: true })).toBeVisible();
			await page.getByRole('tab', { name: 'Source', exact: true }).click();
			await expect(page.getByRole('tabpanel', { name: 'firstCall source' })).toBeVisible();
			await capture(page, `${variant}-source-${commit ? 'commit' : 'tip'}-${viewport}`, units);
			expect(await fits(page)).toBe(true);
		}
	}
}

export async function testFile(page: Page, id: string, commit: string): Promise<void> {
	const path = sourceTestPath(id);
	const list = page.getByRole('list', { name: 'Test files', exact: true });
	await expect(list, 'associated tests have their own file list').toBeVisible();
	await expect(list.getByRole('link', { name: path, exact: true })).toHaveAttribute(
		'href',
		`https://github.com/example/orders/blob/${commit}/${path}`
	);
	const started = await page.evaluate(() => performance.now());
	await list.getByRole('button', { name: `View code for ${path}`, exact: true }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.locator('pre')).toHaveText(sourceText(commit, path));
	await sourceReadMeasurements(page, started, commit, id);
	await capture(
		page,
		`${process.env.SCREENSHOT_LABEL ?? 'run'}-source-test-${id}-${commit.slice(0, 7)}-${(await page.viewportSize())!.width}`,
		['reports.component.harness-entity-source', 'reports.component.source-file-list']
	);
	await page.keyboard.press('Escape');
	await expect(dialog).toHaveCount(0);
}

async function sourceReadMeasurements(
	page: Page,
	started: number,
	commit: string,
	id: string
): Promise<void> {
	const observed = await page.evaluate(
		(start) => ({
			ms: performance.now() - start,
			heap: (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
				?.usedJSHeapSize
		}),
		started
	);
	const base = {
		unit: 'reports.store.source-reader',
		callable: 'archivedSource',
		workload: `open-archived-test-file-${id}-${page.viewportSize()!.width}`,
		target: 'module',
		samples: 1
	};
	const measurements = [
		{
			...base,
			metric: 'latency-cold-ms',
			unitOfMeasure: 'ms',
			value: observed.ms,
			method:
				'Browser time from the test-file code action through the modal displaying the exact archived text.'
		},
		{
			...base,
			metric: 'memory-bytes',
			unitOfMeasure: 'bytes',
			value: observed.heap ?? null,
			method: 'Whole-renderer JavaScript heap after the source read, including shared page code.'
		}
	];
	recordCapture(
		{
			evidence: 'benchmark',
			kind: 'benchmark',
			state: 'test-file',
			file: `source-reader-${id}-${commit}-${page.viewportSize()!.width}.json`,
			mediaType: 'application/json'
		},
		JSON.stringify({ measurements })
	);
}

export async function sourceMetrics(page: Page, info: TestInfo, started: number) {
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
