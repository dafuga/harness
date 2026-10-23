import { reviewModelCard, reviewFlatModelUsage } from './entityPreviewModels';
import {
	reviewHelperCard,
	reviewHelperUsage,
	reviewPrivateFunctions,
	reviewServiceCard
} from './entityPreviewFunctions';
import { expect, test } from '../../../test/support/browserTest';
import {
	capture,
	fits,
	open,
	viewports,
	where,
	reviewVisual,
	reviewStates,
	moduleCard
} from './entityPreviewPage';
import { commits, ids } from './entityUnits';
import { reviewUsage, reviewRelationPaging } from './entityPreviewUsage';
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
		await reviewRelationPaging(tab, name);
	});
	test(`models, components, helpers and services use a card grid at ${name} width`, async ({
		page: tab
	}) => {
		await tab.setViewportSize(size);
		const browserErrors: string[] = [];
		tab.on('pageerror', (error) => browserErrors.push(error.message));
		tab.on('console', (message) => {
			if (message.type() === 'error') browserErrors.push(message.text());
		});
		for (const category of ['models', 'types', 'components', 'functions', 'services'] as const) {
			await open(tab, { category }, 'helpers');
			await tab.evaluate(async () => {
				await document.fonts.ready;
				await Promise.all([...document.images].map((image) => image.decode()));
			});
			await capture(tab, `grid-${category}-${name}`, moduleCard.units);
			const cards = tab.getByRole('article');
			await expect(
				cards,
				'collections use cards; helpers and models require two distinct visible consumers'
			).toHaveCount({ models: 2, types: 1, components: 3, functions: 1, services: 1 }[category]);
			for (const item of await cards.all()) {
				await expect(item).toHaveAttribute('data-harness-component', moduleCard.marker);
				const footer = item.getByRole('group', { name: 'Used In', exact: true });
				expect(await footer.getByRole('link').count()).toBeLessThanOrEqual(3);
				await expect(footer.locator('.ex-usage-kind')).toHaveCount(0);
			}
			const card = (await cards.first().boundingBox())!;
			const available = (await tab.locator('.ex-index').boundingBox())!;
			if (name !== 'mobile') {
				expect(card.width, 'cards leave room for neighbors').toBeLessThan(available.width * 0.6);
			}
			expect(await fits(tab)).toBe(true);
			if (category === 'types') {
				const typeCard = tab.getByRole('article', { name: 'OrderInput', exact: true });
				await expect(typeCard).toBeVisible();
				await typeCard.getByRole('link', { name: 'OrderInput', exact: true }).click();
				expect(await where(tab)).toMatchObject({
					category: 'types',
					entity: 'app.model.order-input'
				});
				await expect(tab.getByRole('heading', { name: 'OrderInput', exact: true })).toBeVisible();
			}
			if (category === 'models') {
				await expect(tab.getByRole('article', { name: 'OrderInput', exact: true })).toHaveCount(0);
				for (const modelCard of await cards.all())
					await reviewFlatModelUsage(
						modelCard.getByRole('group', { name: 'Used In', exact: true })
					);
				await reviewModelCard(tab, name);
				expect(browserErrors, 'the model browser flow has no console or page errors').toEqual([]);
			}
			if (category === 'functions') {
				await reviewHelperCard(tab, cards);
				await reviewHelperUsage(tab, name);
				await reviewPrivateFunctions(tab, name);
			}
			if (category === 'services') await reviewServiceCard(tab, name);
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
			const shot = cards.getByRole('img', { name: 'Screenshot of OrderCard', exact: true });
			const viewed = (commit ?? commits.tip).slice(0, 7);
			await expect(shot).toHaveAttribute('src', `/media/${viewed}-default-desktop.png`);
			expect(await shot.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1440);
			await expect(cards.first()).toContainText('Used In');
			expect(await fits(tab)).toBe(true);
			const title = cards.first().getByRole('heading').getByRole('link');
			await expect(title).toBeVisible();
			await title.press('Enter');
			expect(await where(tab)).toMatchObject({ commit, category: 'components', entity: ids.card });
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
		await capture(tab, `compact-page-${name}`, moduleCard.units);
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
test('the component catalog keeps reused screenshots revision-bound without extra source text', async ({
	page: tab
}) => {
	await open(tab, { category: 'components' }, 'inherited');
	await capture(tab, 'component-cards-reused-desktop');
	const card = tab.getByRole('article', { name: 'OrderCard', exact: true });
	await expect(card.getByRole('img')).toHaveAttribute('src', '/media/bbbbbbb-default-desktop.png');
	await expect(card).not.toContainText(/Reused from|Captured at/);
});
test('branch and commit selection replace component screenshots with that revision', async ({
	page: tab
}) => {
	await open(tab, { category: 'components' }, 'console');
	const card = tab.getByRole('article', { name: 'OrderCard', exact: true });
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
