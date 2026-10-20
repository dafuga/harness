import { expect, test, type Page } from '../../../../test/support/browserTest';
import { analytics, charted, former, idsOf, ordinary } from '../../test/catalog-listing-manifests';
import { listedIds, listedProject, pictured } from './ui-catalog-listing-fixture';

/**
 * The catalog of a project in which former addresses only redirect. The cards are what the real
 * session listed: none for a page manifest that only loads for an address at the shown commit,
 * every ordinary page beside it, and the same identity where an earlier commit renders it.
 */
const pages = idsOf(ordinary.filter(([id]) => id.includes('page.')));
const cards = (page: Page) => page.locator('main.catalog article');

async function opened(page: Page) {
	const project = await listedProject(page);
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Project', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Pages', exact: true, level: 1 })).toBeVisible();
	await expect(cards(page).first()).toBeVisible();
	return project;
}

async function at(page: Page, commit: string) {
	await page.getByLabel('Commit', { exact: true }).selectOption(commit);
	await expect(page).toHaveURL(new RegExp(`/commit/${commit}/pages$`));
	await expect(cards(page).first()).toBeVisible();
}

test('Pages of the tip show every ordinary page and no card for an address that only redirects', async ({
	page
}, info) => {
	await opened(page);
	await pictured(page, info, 'pages-tip');
	await expect(page.getByRole('button', { name: 'Filters', exact: true })).toHaveCount(1);
	await expect(page.getByRole('combobox', { name: 'Verification filter' })).toHaveCount(0);
	expect(await listedIds(page)).toEqual(pages);
	await changeFilter(page, 'Verification filter', 'passed');
	await expect(cards(page)).toHaveCount(0);
	await page.getByRole('button', { name: 'Show all pages' }).click();
	expect(await listedIds(page)).toEqual(pages);
	await changeFilter(page, 'Planning filter', 'planned');
	await expect(cards(page)).toHaveCount(0);
	await page.getByRole('button', { name: 'Filters', exact: true }).click();
	await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
	await page.getByRole('button', { name: 'Done', exact: true }).click();
	await page.getByRole('searchbox', { name: 'Search pages' }).fill('Analytics');
	await expect(cards(page)).toHaveCount(1);
	await page.getByRole('searchbox', { name: 'Search pages' }).fill('');
	await page.getByRole('button', { name: 'Filters', exact: true }).click();
	await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
	await page.getByRole('button', { name: 'Done', exact: true }).click();

	// A real page keeps the name Analytics; so does the service, under Services.
	await expect(cards(page).getByRole('heading', { name: 'Analytics', exact: true })).toHaveCount(1);
	const categories = page.getByRole('navigation', { name: 'Catalog categories' });
	await categories.getByRole('link', { name: 'Services', exact: true }).click();
	await expect(
		page.getByRole('heading', { name: 'Services', exact: true, level: 1 })
	).toBeVisible();
	expect(await listedIds(page)).toEqual(['service.analytics']);
});

test('the identity that only redirects at the tip is a card at the earlier commit that renders it', async ({
	page
}, info) => {
	const project = await opened(page);
	await at(page, project.earlier.revision.commit);
	await pictured(page, info, 'pages-earlier');
	expect(await listedIds(page)).toEqual([analytics, ...pages].sort());
	await expect(cards(page).getByRole('heading', { name: 'Analytics', exact: true })).toHaveCount(2);
	await expect(cards(page).filter({ hasText: former })).toHaveCount(0);
	await at(page, project.tip.revision.commit);
	await pictured(page, info, 'pages-tip-selected');
	expect(await listedIds(page)).not.toContain(analytics);
	await expect(cards(page).filter({ hasText: former })).toHaveCount(0);
});

test('an address that only redirects is still opened by its identity, at the tip and earlier', async ({
	page
}, info) => {
	const project = await opened(page);
	const open = (path: string) =>
		page.evaluate((to) => {
			history.pushState({}, '', to);
			dispatchEvent(new PopStateEvent('popstate'));
		}, path);
	await open(`/harness/branch/main/pages/${analytics}`);
	await expect(page.getByRole('heading', { name: 'Analytics', level: 1 })).toBeVisible();
	await pictured(page, info, 'loader-opened');
	await expect(page.getByText(former).first()).toBeVisible();
	await open(`/harness/branch/main/commit/${project.earlier.revision.commit}/pages/${analytics}`);
	await expect(page.getByText(charted).first()).toBeVisible();
});

async function changeFilter(page: Page, name: string, value: string) {
	await page.getByRole('button', { name: 'Filters', exact: true }).click();
	await page
		.getByRole('dialog', { name: 'Filters', exact: true })
		.getByRole('combobox', { name, exact: true })
		.selectOption(value);
	await page.getByRole('button', { name: 'Done', exact: true }).click();
}
