import { expect, type Page } from '@playwright/test';
import { capture, fits, open, where } from './entityPreviewPage';
/** Function contracts keep actual parameter names and their own returned value. */
export async function reviewCallableContract(page: Page, commit: string | null, viewport: string) {
	for (const [name, result] of [
		['toKebabCase', 'string'],
		['countWords', 'number'],
		['reset', 'void']
	]) {
		await open(page, { category: 'functions', commit }, 'declared');
		await page
			.getByRole('link')
			.filter({ hasText: `${name}(` })
			.click();
		expect(await where(page), 'catalog links identify the selected callable').toMatchObject({
			helper: name,
			commit
		});
		await page.getByRole('tab', { name: 'Contract', exact: true }).click();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
		await expect(page.locator('section[aria-label$=" contract"]')).toHaveCount(1);
		await page.evaluate(async () => {
			await document.fonts.ready;
		});
		await capture(page, `callable-${name}-${commit ? 'commit' : 'tip'}-${viewport}`);
		await reviewCallableApi(page, name, result);
		await page.getByRole('tab', { name: 'Examples', exact: true }).click();
		await capture(page, `callable-examples-${name}-${commit ? 'commit' : 'tip'}-${viewport}`);
		const code = page.locator('.examples pre');
		await expect(code, 'Callable examples are required').toHaveCount(1);
		await expect(code).toContainText(
			name === 'reset' ? 'reset() ?? null' : `${name}("hello world")`
		);
		expect(await fits(page)).toBe(true);
		await page.getByRole('tab', { name: 'History', exact: true }).click();
		expect(await where(page)).toMatchObject({ helper: name, commit, section: 'history' });
		await page.getByRole('tab', { name: 'Contract', exact: true }).click();
		await page.reload();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
	}
	expect(await fits(page)).toBe(true);
	await reviewConsoleAddress(page, commit, viewport);
}

/** The real host resolves readable links and restores them on refresh. */
async function reviewConsoleAddress(page: Page, commit: string | null, viewport: string) {
	await open(
		page,
		{
			category: 'functions',
			entity: 'app.function.filter-orders',
			helper: 'toKebabCase',
			commit,
			tab: 'contract'
		},
		'console'
	);
	await expect(
		page.getByRole('heading', { level: 1 }),
		'the real console resolves callable addresses'
	).toHaveText('toKebabCase');
	await capture(page, `callable-console-${commit ? 'commit' : 'tip'}-${viewport}`);
	await expect(
		page,
		'Readable helper URL without internal module ids or query selectors'
	).toHaveURL(/\/helpers\/toKebabCase\/contract$/);
	const frame = await page.getByRole('heading', { level: 1 }).elementHandle();
	await page.getByRole('tab', { name: 'Examples', exact: true }).click();
	await expect(page).toHaveURL(/\/helpers\/toKebabCase\/examples$/);
	await page.evaluate(() => new Promise(requestAnimationFrame));
	await capture(page, `callable-frame-${commit ? 'commit' : 'tip'}-${viewport}`);
	expect(await frame!.evaluate((node) => node.isConnected), 'Tabs keep their helper frame').toBe(
		true
	);
	await page.reload();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('toKebabCase');

	await open(
		page,
		{
			category: 'functions',
			entity: 'function.generated-0',
			helper: 'filterOrders',
			commit,
			tab: 'contract'
		},
		'console'
	);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('filterOrders');
	await capture(page, `callable-qualified-${commit ? 'commit' : 'tip'}-${viewport}`);
	await expect(page).toHaveURL(/\/helpers\/filterOrders\/in\/function.generated-0\/contract$/);
	await page.reload();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('filterOrders');
}

/** The selected callable owns each parameter, return and error example. */
async function reviewCallableApi(page: Page, name: string, result: string): Promise<void> {
	const api = page.getByRole('region', { name: `${name} contract`, exact: true });
	await expect(api, 'each callable has its own API contract').toBeVisible();
	const signature =
		name === 'reset' ? 'reset(): void' : `${name}(textToConvert: string): ${result}`;
	await expect(api.getByRole('heading')).toContainText(signature);
	const params = api.getByRole('table', { name: 'Parameters', exact: true });
	if (name !== 'reset') {
		await expect(params.getByRole('rowheader')).toHaveText(['textToConvert']);
		await params.getByRole('button').click();
		await expect(page.getByRole('dialog')).toContainText('hello world');
		await page.getByRole('button', { name: 'Close viewer', exact: true }).click();
	} else await expect(params).toContainText('No parameters.');
	const returned = api.getByRole('table', { name: 'Returns', exact: true });
	await expect(returned).toContainText(result);
	const returnNames: Record<string, string> = {
		toKebabCase: 'kebabCaseText',
		countWords: 'wordCount',
		reset: 'noReturnValue'
	};
	const valueName = returnNames[name];
	await expect(
		returned.getByRole('rowheader'),
		'return table includes the declared value name'
	).toHaveText(valueName);
	await returned.getByRole('button').click();
	await expect(page.getByRole('dialog')).toContainText(valueName);
	await page.getByRole('button', { name: 'Close viewer', exact: true }).click();
	const thrown = api.getByRole('table', { name: 'Throws', exact: true });
	await expect(thrown, 'only declared errors need a Throws table').toHaveCount(
		name === 'countWords' ? 1 : 0
	);
	if (name === 'countWords') {
		await thrown.getByRole('button').click();
		await expect(page.getByRole('dialog')).toContainText('Input text required.');
		await page.getByRole('button', { name: 'Close viewer', exact: true }).click();
	}
}
