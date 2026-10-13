import { expect, test, type Page } from '@playwright/test';
import { pictured, related } from './ui-entity-usage-fixture';
import { branch, evidenceFixture, ids, sharedProject } from './ui-evidence-fixture';

/**
 * What the workspace shows of the things around an entity: a section named Used In and one
 * named Uses, on the overview and each at an address of its own. Nothing is called a
 * relationship, and an address of the former section still opens both.
 */
const root = `/projects/${sharedProject}/harness/branch/${encodeURIComponent(branch)}`;
const at = (entity: string, suffix = '') => `${root}/${entity}${suffix}`;
const filter = `functions/${ids.filter}`;
const tabs = (page: Page) => page.getByRole('navigation', { name: 'Entity sections' });
const current = (page: Page) => tabs(page).locator('[aria-current="page"]');
const path = (page: Page) => new URL(page.url()).pathname;
const panel = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
const named = ['Overview', 'Designs', 'Used In', 'Uses', 'Evidence', 'History'];
/** Goes to an address as Back and Forward do: the page stays loaded, and what it shows changes. */
const visit = (page: Page, address: string) =>
	page.evaluate((to) => {
		history.pushState({}, '', to);
		dispatchEvent(new PopStateEvent('popstate'));
	}, address);

async function opened(page: Page, address: string) {
	await evidenceFixture(page);
	await page.goto(at(`pages/${ids.page}`));
	await expect(page.getByRole('heading', { level: 1, name: 'Orders page' })).toBeVisible();
	await related(page);
	await visit(page, address);
	await expect(page.getByRole('heading', { level: 1, name: 'Filter orders' })).toBeVisible();
}

test('the overview of an entity holds Used In and Uses, and no section is named Relationships', async ({
	page
}, info) => {
	await opened(page, at(filter));
	await pictured(page, info, 'workspace-overview');
	await expect(tabs(page).getByRole('button')).toHaveText(named);
	await expect(panel(page, 'Used In').getByRole('link')).toHaveText(['Orders page', 'Order list']);
	await expect(panel(page, 'Used In')).toContainText(/Orders page\s*Page/);
	await expect(panel(page, 'Used In')).toContainText(/Order list\s*Component/);
	for (const kind of ['Configs', 'Services', 'Other'])
		await expect(
			panel(page, 'Uses').getByRole('heading', { name: new RegExp(`^${kind}`) })
		).toBeVisible();
	await expect(panel(page, 'Uses').getByRole('link')).toHaveText(['Order settings', 'Order store']);
	await expect(page.getByText(/relationship|used by/i)).toHaveCount(0);
	for (const name of ['Used In', 'Uses']) await expect(panel(page, name)).not.toContainText('src/');
});

test('Used In and Uses have addresses of their own, and the former address still opens both', async ({
	page
}, info) => {
	await opened(page, at(filter));
	await pictured(page, info, 'workspace-sections');
	await tabs(page).getByRole('button', { name: 'Used In' }).click();
	await expect.poll(() => path(page)).toBe(at(filter, '/used-in'));
	await expect(panel(page, 'Used In').getByRole('link')).toHaveCount(2);
	await expect(panel(page, 'Uses')).toHaveCount(0);
	await pictured(page, info, 'workspace-used-in');
	await tabs(page).getByRole('button', { name: 'Uses', exact: true }).click();
	await expect.poll(() => path(page)).toBe(at(filter, '/uses'));
	await expect(panel(page, 'Uses').getByRole('link')).toHaveCount(2);
	await expect(panel(page, 'Used In')).toHaveCount(0);
	await pictured(page, info, 'workspace-uses');
	await visit(page, at(filter, '/relationships'));
	await expect(current(page)).toHaveText('Overview');
	await expect(panel(page, 'Used In')).toBeVisible();
	await expect(panel(page, 'Uses')).toBeVisible();
	await panel(page, 'Used In').getByRole('link', { name: 'Order list' }).click();
	await expect.poll(() => path(page)).toBe(at(`components/${ids.list}`));
});

test('an entity with nothing recorded around it says so in both sections', async ({
	page
}, info) => {
	await evidenceFixture(page);
	await page.goto(at(`pages/${ids.page}`));
	await expect(page.getByRole('heading', { level: 1, name: 'Orders page' })).toBeVisible();
	await pictured(page, info, 'workspace-nothing-recorded');
	await expect(panel(page, 'Used In')).toContainText('Nothing recorded uses it.');
	await expect(panel(page, 'Uses')).toContainText('No dependency is recorded.');
});
