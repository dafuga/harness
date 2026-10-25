import { moduleValidation } from './support/moduleValidation';
import { expect, test, type Page } from '../../../../test/support/browserTest';
import { generatedUnits } from '../../scripts/harness-scale-data';
import { at, branch, checkpoint, commit, expectPath, explorer, tip } from './support/explorer';
import { viewports } from './support/harnessCapture';
import { seeded } from './support/harnessHistory';
import { fits, screens, sharedField } from './support/sharedSelect';

const { commits, keptBranch } = seeded();
const { explorerUnits: units } = explorer();
const scale = `http://127.0.0.1:${Number(process.env.HARNESS_CONSOLE_E2E_SCALE_PORT || 5593)}`;
const cards = (page: Page) => page.getByRole('main').getByRole('article');
const shown = (page: Page) => page.getByRole('main').getByRole('status');
const search = (page: Page) => page.getByRole('searchbox', { name: /^Search / });
const noFilters = async (page: Page) => {
	await expect(page.getByRole('button', { name: 'Filters', exact: true })).toHaveCount(0);
	await expect(page.getByRole('combobox', { name: 'Order', exact: true })).toHaveCount(0);
	await expect(page.getByRole('switch', { name: 'Changed only', exact: true })).toHaveCount(0);
};
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
	await expect(page.getByRole('tab', { name: 'Models', exact: true })).toBeVisible();
	// The title itself is clicked, as a reader does, not an address that the test put together.
	await titled(page).click();
	await expectPath(page, at('main', commits.approved, 'helpers/slugify/contract'));
	await expect(commit(page)).toHaveValue(commits.approved);
	await expect(page.getByRole('heading', { level: 1, name: 'slugify', exact: true })).toBeVisible();
	await page.goBack();
	await expectPath(page, at('main', commits.approved, 'functions'));
	await page.getByRole('tab', { name: 'Models', exact: true }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Models' })).toBeVisible();
	await expectPath(page, at('main', commits.approved, 'models'));
	await page.getByRole('tab', { name: 'Services', exact: true }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Services' })).toBeVisible();
	await expect(commit(page)).toHaveValue(commits.approved);
});

for (const viewport of viewports) {
	test(`component cards show their title, screenshot and Used In links at ${viewport.id} width`, async ({
		page
	}) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await page.goto(at('main', commits.approved, 'components'));
		const card = named(page, 'TitleList');
		await expect(card).toBeVisible();
		await checkpoint(page, `component-cards-${viewport.id}`);

		await expect(card.getByText('Contains', { exact: true })).toHaveCount(0);
		await expect(card.locator('p')).toHaveCount(0);
		await expect(card.locator('figcaption')).toHaveCount(0);
		await expect(card.getByRole('button')).toHaveCount(0);
		await expect(card.getByRole('link', { name: 'Open component', exact: true })).toHaveCount(0);
		await expect(
			card.getByRole('heading', { level: 2, name: 'TitleList', exact: true })
		).toHaveCount(1);
		await expect(card.locator('.ex-card-shot img, .ex-card-shot .ex-thumb-gap')).toBeVisible();
		await expect(card.getByRole('group', { name: 'Used In', exact: true })).toBeVisible();
		await expect(card.getByRole('link', { name: 'Titles', exact: true })).toBeVisible();

		// The name is a link inside its heading, and the screenshot is a second way to the same page.
		const title = card
			.getByRole('heading', { level: 2, name: 'TitleList', exact: true })
			.getByRole('link', { name: 'TitleList', exact: true });
		await expect(title).toBeVisible();
		const shot = card.getByRole('link', { name: 'Open TitleList', exact: true });
		await expect(
			shot
				.getByRole('img', { name: 'Screenshot of TitleList', exact: true })
				.or(shot.getByText('No screenshot is recorded at this revision', { exact: true }))
		).toBeVisible();
		const detail = await title.getAttribute('href');
		expect(detail).toBeTruthy();
		await expect(shot).toHaveAttribute('href', detail!);
	});
}

test('the keyboard searches the current catalog and opens an entity', async ({ page }) => {
	await page.goto(at('main', commits.approved, 'functions'));
	await noFilters(page);
	await search(page).focus();
	await page.keyboard.type('missing-helper');
	await expect(shown(page)).toHaveText('0 of 1 helpers shown');
	await page.keyboard.press('ControlOrMeta+A');
	await page.keyboard.type('slug');
	await expect(shown(page)).toHaveText('1 of 1 helpers shown');
	await expect(cards(page).first()).toHaveAttribute('aria-label', 'slugify');
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
	await noFilters(page);
	await expect(shown(page)).toHaveText('1 of 1 helpers shown');
	await page.goto(at('main', commits.approved, 'functions/function.extra'));
	await expect(
		page.getByRole('heading', { name: 'Not at this revision', exact: true })
	).toBeVisible();
	await expect(page.getByText(/Nothing named function.extra is in the registry/)).toBeVisible();
	await checkpoint(page, 'catalog-missing');
	await page.goto(at('main', commits.added, 'functions/function.extra'));
	await expect(page.getByRole('heading', { level: 1, name: 'extra', exact: true })).toBeVisible();
	await page.goto(at('main', commits.removed, 'functions/function.extra'));
	await checkpoint(page, 'catalog-removed');
	await expect(
		page.getByRole('button', { name: 'Removed at this commit', exact: true })
	).toBeVisible();
	await expect(page.getByRole('heading', { level: 1, name: 'extra', exact: true })).toBeVisible();
	await expect(
		page.getByRole('heading', { name: 'Not at this revision', exact: true })
	).toHaveCount(0);
});

test('an unverified commit retains its catalog and marks missing evidence on source details', async ({
	page
}) => {
	await page.goto(tip('main', 'functions'));
	await expect(commit(page)).toHaveValue(commits.sourceOnly);
	await noFilters(page);
	await checkpoint(page, 'catalog-unverified-change');
	await expect(shown(page)).toHaveText('1 of 1 helpers shown');
	await page.goto(tip('main', 'services/service.clock?tab=uses'));
	await page.locator('a[href*="/functions/function.clock"]').click();
	await expect(
		page.locator('.ex-head').getByRole('button', { name: 'Evidence missing', exact: true })
	).toBeVisible();
	// What only depends on the changed function was not changed by this commit itself.
	await page.goto(tip('main', 'services'));
	await noFilters(page);
	const services = await cards(page).count();
	await expect(shown(page)).toHaveText(`${services} of ${services} services shown`);
});

for (const [screen, width, height] of screens) {
	test(`branch and commit are shared fields and each choice is a path at ${screen} width`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height });
		await page.goto(tip('main', 'functions'));
		for (const field of [branch(page), commit(page)]) await sharedField(field);
		await noFilters(page);
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
		await noFilters(page);
		await expect(cards(page).first()).toHaveAttribute('aria-label', 'unit030');
		await titled(page).focus();
		await page.keyboard.press('Enter');
		await expectPath(page, tip('main', 'helpers/unit030/contract'));
	});

	test('on a phone the list reaches any unit without scrolling sideways', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(tip('main', 'functions'));
		await search(page).fill('generated 477');
		await expect(cards(page)).toHaveCount(1);
		expect(await fits(page)).toBe(true);
		await cards(page).locator('.ex-function-call').click();
		await expectPath(page, tip('main', 'helpers/unit477/contract'));
	});
});

for (const viewport of viewports)
	test(`catalog requires committed module data at ${viewport.id}`, async ({ page }) => {
		await moduleValidation(page, viewport);
	});
