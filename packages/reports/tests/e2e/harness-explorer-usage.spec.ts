import { expect, test, type Page } from '../../../../test/support/browserTest';
import { at, checkpoint, expectNoOverflow, expectPath, explorer } from './support/explorer';
import { seeded } from './support/harnessHistory';

/**
 * What an entity is shown with of the things around it, in the seeded history: a section named
 * Used In and one named Uses, each on the overview and each at an address of its own. Nothing is
 * called a relationship, and an address of the former section still opens both.
 */
const { commits } = seeded();
const { explorerUnits: units } = explorer();
const main = (rest: string) => at('main', commits.approved, rest);
const content = (page: Page) => page.locator('.ex-content');
const card = (page: Page, name: string) => content(page).getByRole('region', { name, exact: true });
const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name });
const named = ['Overview', 'Used In', 'Uses', 'Tests', 'History'];
const sectionsOf = (page: Page, entity: string) =>
	page.getByRole('tablist', { name: `${entity} sections` }).getByRole('tab');

test('an address of the former relationships section still opens both sections, under their names', async ({
	page
}) => {
	await page.goto(main(`pages/${units.page}?tab=relationships`));
	await expect(heading(page, 'Titles')).toBeVisible();
	await checkpoint(page, 'usage-former-address');
	await expect(sectionsOf(page, 'Titles')).toHaveText(named);
	await expect(card(page, 'Used In')).toBeVisible();
	await expect(card(page, 'Uses')).toBeVisible();
	await expect(
		card(page, 'Uses').getByRole('link', { name: 'Title list', exact: true })
	).toBeVisible();
	await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(content(page).getByText(/relationship/i)).toHaveCount(0);
	await expectNoOverflow(page);
});

test('Used In and Uses are sections of their own, from the navigation and by address', async ({
	page
}) => {
	await page.goto(main(`components/${units.list}`));
	await expect(heading(page, 'Title list')).toBeVisible();
	await checkpoint(page, 'usage-component-overview');
	await expect(sectionsOf(page, 'Title list')).toHaveText(named);
	await page.getByRole('tab', { name: 'Used In' }).click();
	await expectPath(page, main(`components/${units.list}?tab=used-in`));
	await checkpoint(page, 'usage-used-in');
	await expect(
		card(page, 'Used In').getByRole('link', { name: 'Titles', exact: true })
	).toBeVisible();
	await expect(card(page, 'Used In')).toContainText('Page');
	await expect(card(page, 'Used In')).not.toContainText('src/');
	await expect(card(page, 'Uses')).toHaveCount(0);
	await page.getByRole('tab', { name: 'Uses', exact: true }).click();
	await expectPath(page, main(`components/${units.list}?tab=uses`));
	await checkpoint(page, 'usage-uses');
	await expect(card(page, 'Uses').getByRole('heading', { name: /^Components/ })).toBeVisible();
	await expect(card(page, 'Used In')).toHaveCount(0);
	await expect(card(page, 'Uses')).not.toContainText('src/');
	await card(page, 'Uses').getByRole('link', { name: 'Title row', exact: true }).click();
	await expectPath(page, main(`components/${units.row}`));
});

test('a function says where it is used, down from the page that shows it', async ({ page }) => {
	await page.goto(main(`functions/${units.slugify}`));
	await expect(heading(page, 'Slugify')).toBeVisible();
	await checkpoint(page, 'usage-function-overview');
	const used = card(page, 'Used In');
	await expect(used.getByRole('link', { name: 'Titles', exact: true })).toHaveCount(1);
	await expect(used.getByRole('link', { name: 'Title row', exact: true })).toHaveCount(1);
	await expect(card(page, 'Uses')).toBeVisible();
	await used.getByRole('link', { name: 'Title row', exact: true }).click();
	await expectPath(page, main(`components/${units.row}`));
});
