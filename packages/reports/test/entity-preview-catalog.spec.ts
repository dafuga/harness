import {
	reviewHelperCard,
	reviewHelperUsage,
	reviewPrivateFunctions
} from './entityPreviewFunctions';
import { expect, test } from '../../../test/support/browserTest';
import { capture, fits, open, viewports, where } from './entityPreviewPage';
import { commits, ids } from './entityUnits';
for (const [name, size] of Object.entries(viewports)) {
	test(`component and function lists use a card grid at ${name} width`, async ({ page: tab }) => {
		await tab.setViewportSize(size);
		for (const category of ['components', 'functions'] as const) {
			await open(tab, { category }, 'helpers');
			await tab.evaluate(async () => {
				await document.fonts.ready;
				await Promise.all([...document.images].map((image) => image.decode()));
			});
			await capture(tab, `grid-${category}-${name}`);
			const cards = tab.getByRole('article');
			await expect(
				cards,
				'only helpers used in two distinct visible places are listed'
			).toHaveCount(category === 'components' ? 3 : 1);
			const card = (await cards.first().boundingBox())!;
			const available = (await tab.locator('.ex-index').boundingBox())!;
			if (name !== 'mobile') {
				expect(card.width, 'cards leave room for neighbors').toBeLessThan(available.width * 0.6);
			}
			expect(await fits(tab)).toBe(true);
			if (category === 'functions') {
				await reviewHelperCard(tab, cards);
				await reviewHelperUsage(tab, name);
				await reviewPrivateFunctions(tab, name);
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
			await expect(cards.first()).toHaveText(/Order card\s+Used In\s+Order list\s+Orders page/);
			await expect(cards.first().locator('button, .hx-verdict, .ex-fact, figcaption')).toHaveCount(
				0
			);
			const usage = cards.first().getByRole('group', { name: 'Used In' });
			await usage.getByRole('link', { name: 'Order list', exact: true }).click();
			expect(await where(tab)).toMatchObject({ commit, category: 'components', entity: ids.list });
			await open(tab, { category: 'components', commit });
			expect(await fits(tab)).toBe(true);
			const action = cards.first().getByRole('link', { name: 'Order card', exact: true });
			await action.press('Enter');
			expect(await where(tab)).toMatchObject({ commit, category: 'components', entity: ids.card });
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
	await expect(card.getByRole('link', { name: 'Open Order card', exact: true })).toHaveAttribute(
		'title',
		/Reused from bbbbbbb/
	);
	await expect(card).not.toContainText('Reused from');
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
