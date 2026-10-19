import { expect, test, type Page } from '../../../../test/support/browserTest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { at, branch, checkpoint, commit, expectPath, explorer, tip } from './support/explorer';
import { home, seeded } from './support/harnessHistory';
import { fits, screens, sharedField, typed } from './support/sharedSelect';

const { commits, keptBranch } = seeded();
const { explorerUnits: units } = explorer();
const scale = `http://127.0.0.1:${Number(process.env.HARNESS_CONSOLE_E2E_SCALE_PORT || 5593)}`;
const cards = (page: Page) => page.getByRole('main').getByRole('article');
const shown = (page: Page) => page.getByRole('main').getByRole('status');
const search = (page: Page) => page.getByRole('searchbox', { name: /^Search / });
const order = (page: Page) => page.getByRole('combobox', { name: 'Order' });
const changedOnly = (page: Page) => page.getByRole('switch', { name: 'Changed only' });
/** The name link of a card, apart from its test and open actions. */
const titled = (page: Page) =>
	cards(page).first().getByRole('heading', { level: 2 }).getByRole('link');
const named = (page: Page, name: string) =>
	cards(page).filter({ has: page.getByRole('heading', { name, exact: true }) });

test('a catalog is searchable, and a click on a listed entity opens it in the same scope', async ({
	page
}) => {
	await page.goto(at('main', commits.approved, 'functions'));
	await expect(shown(page)).toHaveText('2 of 2 functions shown');
	await search(page).fill('slug');
	await expect(shown(page)).toHaveText('1 of 2 functions shown');
	await expect(cards(page)).toHaveCount(1);
	await checkpoint(page, 'catalog-search');
	// The title itself is clicked, as a reader does, not an address that the test put together.
	await cards(page)
		.getByRole('heading', { level: 2 })
		.getByRole('link', { name: 'Slugify' })
		.click();
	await expectPath(page, at('main', commits.approved, `functions/${units.slugify}`));
	await expect(commit(page)).toHaveValue(commits.approved);
	await expect(page.getByRole('heading', { level: 1, name: 'Slugify' })).toBeVisible();
	await page.goBack();
	await expectPath(page, at('main', commits.approved, 'functions'));
});

test('the keyboard reaches the controls, changes the order and opens an entity', async ({
	page
}) => {
	await page.goto(at('main', commits.approved, 'functions'));
	await page.getByRole('button', { name: 'Filters', exact: true }).click();
	await sharedField(order(page));
	await typed(page, order(page), 'Order: Name (Z');
	await page.getByRole('button', { name: 'Done', exact: true }).click();
	await expect(titled(page)).toHaveText('Slugify');
	await page.getByRole('button', { name: 'Filters', exact: true }).click();
	await changedOnly(page).focus();
	await page.keyboard.press('Space');
	await page.getByRole('button', { name: 'Done', exact: true }).click();
	await expect(shown(page)).toHaveText('0 of 2 functions shown');
	await page.getByRole('button', { name: 'Filters', exact: true }).click();
	await changedOnly(page).focus();
	await page.keyboard.press('Space');
	await page.getByRole('button', { name: 'Done', exact: true }).click();
	await titled(page).focus();
	await page.keyboard.press('Enter');
	await expectPath(page, at('main', commits.approved, `functions/${units.slugify}`));
});

test('a selected commit lists what it added, and what it removed from its first parent', async ({
	page
}) => {
	await page.goto(at('main', commits.approved, 'functions'));
	await expect(named(page, 'Extra')).toHaveCount(0);
	await page.goto(at('main', commits.added, 'functions'));
	await page.getByRole('button', { name: 'Filters', exact: true }).click();
	await changedOnly(page).click();
	await page.getByRole('button', { name: 'Done', exact: true }).click();
	await expect(cards(page).getByRole('heading', { level: 2 }).getByRole('link')).toHaveText([
		'Extra'
	]);
	await page.goto(at('main', commits.removed, 'functions'));
	await checkpoint(page, 'catalog-removed');
	await expect(named(page, 'Extra')).toBeVisible();
	await named(page, 'Extra').getByRole('link', { name: 'Extra', exact: true }).click();
	await expect(
		page.getByRole('button', { name: 'Removed at this commit', exact: true })
	).toBeVisible();
	// The commit after the removal no longer holds it, and nothing is carried over.
	await page.goto(at('main', commits.reordered, 'functions'));
	await expect(shown(page)).toHaveText('2 of 2 functions shown');
	await expect(named(page, 'Extra')).toHaveCount(0);
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
	await expect(cards(page).getByRole('heading', { level: 2 }).getByRole('link')).toHaveText([
		'Clock'
	]);
	await expect(cards(page).first().locator('.hx-verdict')).toHaveCount(0);
	await titled(page).click();
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
	const stored = JSON.parse(
		readFileSync(join(home, 'scale/revisions', `${commits.sourceOnly}.json`), 'utf8')
	) as { registry: { units: Array<{ kind: string; status: string }> } };
	const functions = stored.registry.units.filter(
		(unit) => unit.status === 'active' && ['function', 'kernel'].includes(unit.kind)
	).length;

	test('stays searchable, ordered and keyboard operable', async ({ page }) => {
		expect(functions).toBeGreaterThan(400);
		await page.goto(tip('main', 'functions'));
		await expect(shown(page)).toHaveText(`${functions} of ${functions} functions shown`);
		await expect(cards(page)).toHaveCount(functions);
		await search(page).fill('generated 30');
		// Ten units are numbered 300 to 309; a few more may say 30 in what they are for.
		expect(await cards(page).count()).toBeGreaterThanOrEqual(10);
		expect(await cards(page).count()).toBeLessThan(20);
		await page.getByRole('button', { name: 'Filters', exact: true }).click();
		await typed(page, order(page), 'Order: Name (Z');
		await page.getByRole('button', { name: 'Done', exact: true }).click();
		await expect(titled(page)).toHaveText('Generated 309');
		await titled(page).focus();
		await page.keyboard.press('Enter');
		await expectPath(page, tip('main', 'functions/function.generated-309'));
	});

	test('on a phone the list reaches any unit without scrolling sideways', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(tip('main', 'functions'));
		await search(page).fill('generated 477');
		await expect(cards(page)).toHaveCount(1);
		expect(await fits(page)).toBe(true);
		await cards(page).getByRole('link', { name: 'Open function', exact: true }).click();
		await expectPath(page, tip('main', 'functions/function.generated-477'));
	});
});
