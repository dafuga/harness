import { expect, test, type Page } from '../../../../test/support/browserTest';
import { generatedUnits } from '../../scripts/harness-scale-data';
import { at, branch, checkpoint, commit, expectPath, tip } from './support/explorer';
import { seeded } from './support/harnessHistory';
import { fits, screens, sharedField, typed } from './support/sharedSelect';

const { commits, keptBranch } = seeded();
const scale = `http://127.0.0.1:${Number(process.env.HARNESS_CONSOLE_E2E_SCALE_PORT || 5593)}`;
const cards = (page: Page) => page.getByRole('main').getByRole('article');
const shown = (page: Page) => page.getByRole('main').getByRole('status');
const search = (page: Page) => page.getByRole('searchbox', { name: /^Search / });
const order = (page: Page) => page.getByRole('combobox', { name: 'Order' });
const changedOnly = (page: Page) => page.getByRole('switch', { name: 'Changed only' });
/** The name link of a card, apart from its test and open actions. */
const titled = (page: Page) => cards(page).first().getByRole('link').first();
const named = (page: Page, name: string) =>
	page.getByRole('main').getByRole('article', { name, exact: true });

test('a catalog is searchable, and a click on a listed entity opens it in the same scope', async ({
	page
}) => {
	await page.goto(at('main', commits.approved, 'functions'));
	await expect(cards(page)).toHaveCount(1);
	await checkpoint(page, 'catalog-search');
	await expect(page.getByRole('heading', { level: 1, name: 'Helpers' })).toBeVisible();
	await expect(shown(page)).toHaveText('1 of 1 helpers shown');
	await search(page).fill('slug');
	await expect(shown(page)).toHaveText('1 of 1 helpers shown');
	await expect(cards(page)).toHaveCount(1);
	await expect(cards(page).locator('code')).toHaveText(/^slugify\(/);
	await expect(cards(page).getByRole('heading')).toHaveCount(0);
	await expect(cards(page).getByRole('button')).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Models', exact: true })).toBeVisible();
	// The title itself is clicked, as a reader does, not an address that the test put together.
	await titled(page).click();
	await expectPath(page, at('main', commits.approved, 'helpers/slugify/contract'));
	await expect(commit(page)).toHaveValue(commits.approved);
	await expect(page.getByRole('heading', { level: 1, name: 'slugify' })).toBeVisible();
	await page.reload();
	await expect(page.getByRole('heading', { level: 1, name: 'slugify' })).toBeVisible();
	await checkpoint(page, 'catalog-helper-contract');
	await page.goBack();
	await expectPath(page, at('main', commits.approved, 'functions'));
	await page.getByRole('link', { name: 'Models', exact: true }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Models' })).toBeVisible();
	await expectPath(page, at('main', commits.approved, 'models'));
	await page.getByRole('link', { name: 'Services', exact: true }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Services' })).toBeVisible();
	await expect(commit(page)).toHaveValue(commits.approved);
});

test('the keyboard reaches the controls, changes the order and opens an entity', async ({
	page
}) => {
	await page.goto(at('main', commits.approved, 'functions'));
	await page.getByRole('button', { name: 'Filters', exact: true }).click();
	await sharedField(order(page));
	await typed(page, order(page), 'Order: Name (Z');
	await page.getByRole('button', { name: 'Done', exact: true }).click();
	await expect(cards(page).first()).toHaveAttribute('aria-label', 'slugify');
	await page.getByRole('button', { name: 'Filters', exact: true }).click();
	await changedOnly(page).focus();
	await page.keyboard.press('Space');
	await page.getByRole('button', { name: 'Done', exact: true }).click();
	await expect(shown(page)).toHaveText('0 of 1 helpers shown');
	await page.getByRole('button', { name: 'Filters', exact: true }).click();
	await changedOnly(page).focus();
	await page.keyboard.press('Space');
	await page.getByRole('button', { name: 'Done', exact: true }).click();
	await titled(page).focus();
	await page.keyboard.press('Enter');
	await expectPath(page, at('main', commits.approved, 'helpers/slugify/contract'));
});

test('private helpers stay off the shared catalog while their historical pages remain reachable', async ({
	page
}) => {
	for (const selected of [commits.approved, commits.added, commits.removed, commits.reordered]) {
		await page.goto(at('main', selected, 'functions'));
		await expect(shown(page)).toHaveText('1 of 1 helpers shown');
		await expect(named(page, 'extra')).toHaveCount(0);
	}
	await page.goto(at('main', commits.added, 'functions'));
	await page.getByRole('button', { name: 'Filters', exact: true }).click();
	await changedOnly(page).click();
	await page.getByRole('button', { name: 'Done', exact: true }).click();
	await expect(shown(page)).toHaveText('0 of 1 helpers shown');
	await page.goto(at('main', commits.removed, 'functions/function.extra'));
	await checkpoint(page, 'catalog-removed');
	await expect(
		page.getByRole('button', { name: 'Removed at this commit', exact: true })
	).toBeVisible();
});

test('a commit nobody verified still marks what its source changed, and proves none of it', async ({
	page
}) => {
	await page.goto(tip('main', 'functions'));
	await expect(commit(page)).toHaveValue(commits.sourceOnly);
	await page.getByRole('button', { name: 'Filters', exact: true }).click();
	await changedOnly(page).click();
	await page.getByRole('button', { name: 'Done', exact: true }).click();
	await checkpoint(page, 'catalog-unverified-change');
	await expect(shown(page)).toHaveText('0 of 1 helpers shown');
	await page.goto(tip('main', 'services/service.clock?tab=uses'));
	await page.locator('a[href*="/functions/function.clock"]').click();
	await expect(
		page.locator('.ex-head').getByRole('button', { name: 'Evidence missing', exact: true })
	).toBeVisible();
	// What only depends on the changed function was not changed by this commit itself.
	await page.goto(tip('main', 'services'));
	await page.getByRole('button', { name: 'Filters', exact: true }).click();
	await changedOnly(page).click();
	await page.getByRole('button', { name: 'Done', exact: true }).click();
	await expect(shown(page)).toContainText('0 of ');
});

for (const [screen, width, height] of screens) {
	test(`branch, commit and order are shared fields and each choice is a path at ${screen} width`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height });
		await page.goto(tip('main', 'functions'));
		for (const field of [branch(page), commit(page)]) await sharedField(field);
		await page.getByRole('button', { name: 'Filters', exact: true }).click();
		await sharedField(order(page));
		await page.getByRole('button', { name: 'Done', exact: true }).click();
		await branch(page).selectOption(keptBranch);
		await expectPath(page, tip(keptBranch, 'functions'));
		await commit(page).selectOption(commits.baseline);
		await expectPath(page, at(keptBranch, commits.baseline, 'functions'));
		await page.reload();
		await expect(commit(page)).toHaveValue(commits.baseline);
		expect(await fits(page)).toBe(true);
	});
}

test.describe('a registry of several hundred units', () => {
	test.use({ baseURL: scale });
	const functions = generatedUnits + 1; // All synthetic helpers plus the shared source helper.

	test('stays searchable, ordered and keyboard operable', async ({ page }) => {
		expect(functions).toBeGreaterThan(400);
		await page.goto(tip('main', 'functions'));
		await expect(shown(page)).toHaveText(`${functions} of ${functions} helpers shown`);
		await expect(cards(page)).toHaveCount(functions);
		await search(page).fill('generated 30');
		// Ten units are numbered 300 to 309; a few more may say 30 in what they are for.
		expect(await cards(page).count()).toBeGreaterThanOrEqual(10);
		expect(await cards(page).count()).toBeLessThan(20);
		await page.getByRole('button', { name: 'Filters', exact: true }).click();
		await typed(page, order(page), 'Order: Name (Z');
		await page.getByRole('button', { name: 'Done', exact: true }).click();
		await expect(cards(page).first()).toHaveAttribute('aria-label', 'unit309');
		await titled(page).focus();
		await page.keyboard.press('Enter');
		await expectPath(page, tip('main', 'helpers/unit309/contract'));
	});

	test('on a phone the list reaches any unit without scrolling sideways', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(tip('main', 'functions'));
		await search(page).fill('generated 477');
		await expect(cards(page)).toHaveCount(1);
		expect(await fits(page)).toBe(true);
		await titled(page).click();
		await expectPath(page, tip('main', 'helpers/unit477/contract'));
	});
});
