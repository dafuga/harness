import { expect, test } from '../../../test/support/browserTest';
import { capture, fits, open, viewports, where } from './entityPreviewPage';
import { commits, ids } from './entityUnits';

const page = { category: 'pages' as const, entity: ids.page };
for (const [name, size] of Object.entries(viewports)) {
	test(`component and function lists use a card grid at ${name} width`, async ({ page: tab }) => {
		await tab.setViewportSize(size);
		for (const category of ['components', 'functions'] as const) {
			await open(tab, { category });
			await tab.evaluate(async () => {
				await document.fonts.ready;
				await Promise.all([...document.images].map((image) => image.decode()));
			});
			await capture(tab, `grid-${category}-${name}`);
			const cards = tab.getByRole('article');
			await expect(cards, 'both catalogs use cards').toHaveCount(category === 'components' ? 3 : 1);
			const card = (await cards.first().boundingBox())!;
			const available = (await tab.locator('.ex-index').boundingBox())!;
			if (name !== 'mobile') {
				expect(card.width, 'cards leave room for neighbors').toBeLessThan(available.width * 0.6);
			}
			expect(await fits(tab)).toBe(true);
			if (category === 'functions') {
				await expect(cards.getByRole('img')).toHaveCount(0);
				await expect(cards.first()).toContainText('Inputs');
				await expect(cards.first()).toContainText('Output');
				await cards.getByRole('link', { name: 'Open function', exact: true }).press('Enter');
				expect(await where(tab)).toMatchObject({ category, entity: ids.filter, commit: null });
			}
		}
	});

	test(`component screenshot cards follow the shown revision at ${name} width`, async ({
		page: tab
	}) => {
		await tab.setViewportSize(size);
		for (const commit of [null, commits.middle, commits.first]) {
			await open(tab, { category: 'components', commit });
			await tab.evaluate(async () => {
				await document.fonts.ready;
				await Promise.all([...document.images].map((image) => image.decode()));
			});
			await capture(tab, `component-cards-${commit?.slice(0, 7) ?? 'tip'}-${name}`);
			const cards = tab.getByRole('article');
			await expect(cards, 'components show screenshot cards').toHaveCount(3);
			const shot = cards.getByRole('img', { name: 'Screenshot of Order card', exact: true });
			const viewed = (commit ?? commits.tip).slice(0, 7);
			await expect(shot).toHaveAttribute('src', `/media/${viewed}-default-desktop.png`);
			expect(await shot.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1440);
			await expect(cards.first()).toContainText('Used on');
			expect(await fits(tab)).toBe(true);
			const action = cards.first().getByRole('link', { name: 'Open component', exact: true });
			expect((await action.innerText()).trim()).toBe('');
			expect(await action.boundingBox()).toMatchObject({ width: 36, height: 36 });
			await action.press('Enter');
			expect(await where(tab)).toMatchObject({ commit, category: 'components', entity: ids.card });
		}
	});

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

test('the component catalog labels reused screenshots with their original commit', async ({
	page: tab
}) => {
	await open(tab, { category: 'components' }, 'inherited');
	await capture(tab, 'component-cards-reused-desktop');
	const card = tab.getByRole('article', { name: 'Order card', exact: true });
	await expect(card.getByRole('img')).toHaveAttribute('src', '/media/bbbbbbb-default-desktop.png');
	await expect(card).toContainText('Reused from bbbbbbb');
	await expect(card).not.toContainText('Captured at ccccccc');
});

test('branch and commit selection replace component screenshots with that revision', async ({
	page: tab
}) => {
	await open(tab, { category: 'components' }, 'console');
	const card = tab.getByRole('article', { name: 'Order card', exact: true });
	await expect(card.getByRole('img')).toHaveAttribute(
		'src',
		'/harness/media/ccccccc-default-desktop.png'
	);
	await tab.getByRole('combobox', { name: 'Commit', exact: true }).selectOption(commits.middle);
	await expect(card.getByRole('img')).toHaveAttribute(
		'src',
		'/harness/media/bbbbbbb-default-desktop.png'
	);
	await tab.getByRole('combobox', { name: 'Branch', exact: true }).selectOption('release/orders');
	await expect(card.getByRole('img')).toHaveAttribute(
		'src',
		'/harness/media/aaaaaaa-default-desktop.png'
	);
	await tab.getByRole('combobox', { name: 'Branch', exact: true }).selectOption('feature/orders');
	await expect(card.getByRole('img')).toHaveAttribute(
		'src',
		'/harness/media/ccccccc-default-desktop.png'
	);
});
