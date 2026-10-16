import { expect, test, type Page } from '@playwright/test';
import { alpha, beta, earlier, projectFixture, tip } from './ui-project-fixture';

type Call = Record<string, unknown>;
const calls = (page: Page) =>
	page.evaluate(() => (window as unknown as { __calls: Call[] }).__calls);
const categories = (page: Page) => page.getByRole('navigation', { name: 'Catalog categories' });
/** Listing projects or CLI providers names no project; every other request names the shown one. */
const scoped = (made: Call[]) =>
	made.filter((call) => !['listProjects', 'providers'].includes(String(call.op)));

async function openAlpha(page: Page) {
	await projectFixture(page);
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Alpha', exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`/projects/${alpha}/harness/branch/feat%2Falpha/pages$`));
}

test('the project switcher keeps the category and shows only the chosen project', async ({
	page
}) => {
	await openAlpha(page);
	const project = page.getByLabel('Project', { exact: true });
	await expect(project).toHaveValue(alpha);
	await expect(project.locator('optgroup[label="On this device"] option')).toHaveText([
		'Alpha',
		'Beta'
	]);
	await expect(project.locator('optgroup[label="Shared"] option')).toHaveText(['Gamma']);
	await expect(page.getByRole('button', { name: 'Add local project', exact: true })).toBeVisible();
	const components = categories(page).getByRole('link', { name: 'Components', exact: true });
	await expect(components).toHaveAttribute(
		'href',
		`/projects/${alpha}/harness/branch/feat%2Falpha/components`
	);
	await components.click();
	await expect(page.getByRole('heading', { name: 'Alpha button', exact: true })).toBeVisible();
	const before = (await calls(page)).length;
	await project.selectOption(beta);
	await expect(page).toHaveURL(new RegExp(`/projects/${beta}/harness/branch/main/components$`));
	await expect(page.getByRole('heading', { name: 'Beta button', exact: true })).toBeVisible();
	await expect(page.getByRole('main').getByText(/Alpha/)).toHaveCount(0);
	await expect(page).toHaveTitle('Harness · Beta');
	await expect(project).toHaveValue(beta);
	const later = scoped((await calls(page)).slice(before));
	expect(later.length).toBeGreaterThan(0);
	expect(later.filter((call) => call.projectId !== beta)).toEqual([]);
	expect(later.map((call) => call.op)).toContain('capabilities');
});

test('an answer for the previous project that arrives late is never rendered', async ({ page }) => {
	await openAlpha(page);
	await page.evaluate(() => {
		(window as unknown as { __projects: { delay: Record<string, number> } }).__projects.delay = {
			entity: 600
		};
	});
	await page.getByRole('link', { name: 'Review designs' }).click();
	await page.getByLabel('Project', { exact: true }).selectOption(beta);
	const betaPages = new RegExp(`/projects/${beta}/harness/branch/main/pages$`);
	await expect(page).toHaveURL(betaPages);
	await page.waitForTimeout(900);
	await expect(page).toHaveURL(betaPages);
	await expect(page.getByRole('heading', { name: 'Beta activity', exact: true })).toBeVisible();
	await expect(page.getByRole('main').getByText(/Alpha/)).toHaveCount(0);
	await expect(page.getByRole('complementary', { name: 'Design conversation' })).toHaveCount(0);
	await expect(page.locator('.image-canvas')).toHaveCount(0);
});

test('the same entity id of another project shows no thread, message or image of the first', async ({
	page
}) => {
	await openAlpha(page);
	await page.getByRole('link', { name: 'Review designs' }).click();
	await page.getByRole('button', { name: 'Open thread 1', exact: true }).click();
	await expect(page.getByText('Alpha: keep the filters on one line.')).toBeVisible();
	await expect(
		page.getByRole('img', { name: 'Alpha activity v002 desktop default' })
	).toBeVisible();
	const before = (await calls(page)).length;
	await page.evaluate((path) => {
		history.pushState({}, '', path);
		dispatchEvent(new PopStateEvent('popstate'));
	}, `/projects/${beta}/harness/branch/main/pages/page%3Aactivity`);
	await expect(page.getByRole('heading', { level: 1, name: 'Beta activity' })).toBeVisible();
	await expect(
		page.getByRole('heading', { name: 'Beta activity · New conversation' })
	).toBeVisible();
	await expect(page.getByText('Alpha: keep the filters on one line.')).toHaveCount(0);
	await expect(page.getByRole('button', { name: /^Thread 1/ })).toHaveCount(0);
	await expect(page.locator('.image-canvas')).toHaveCount(0);
	await expect(page.getByRole('main').getByRole('img')).toHaveCount(0);
	const later = scoped((await calls(page)).slice(before));
	expect(later.filter((call) => call.projectId !== beta)).toEqual([]);
	await page.goBack();
	await expect(page.getByRole('heading', { level: 1, name: 'Alpha activity' })).toBeVisible();
	await expect(
		page.getByRole('img', { name: 'Alpha activity v002 desktop default' })
	).toBeVisible();
	await expect(page.getByText(/Beta activity/)).toHaveCount(0);
});

test('a project link opens its project, full commit, entity and History', async ({ page }) => {
	await projectFixture(page);
	const pinned = `/projects/${alpha}/harness/branch/feat%2Falpha/commit/${earlier}/pages`;
	await page.goto(`${pinned}/page%3Aactivity/history`);
	await expect(page.getByRole('heading', { name: 'Entity history', exact: true })).toBeVisible();
	await expect(page.getByLabel('Project', { exact: true })).toHaveValue(alpha);
	await expect(page.getByLabel('Branch', { exact: true })).toHaveValue('feat/alpha');
	await expect(page.getByLabel('Commit', { exact: true })).toHaveValue(earlier);
	await expect(page.getByText(`Tip · ${tip.slice(0, 7)}`, { exact: true })).toBeVisible();
	await expect(
		page.getByText(`Historical commit · ${earlier.slice(0, 7)}`, { exact: true })
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'pages › Alpha activity' })).toHaveAttribute(
		'href',
		pinned
	);
	expect((await calls(page))[0]).toMatchObject({ op: 'selectProject', projectId: alpha });
	await page.getByRole('button', { name: 'Go to tip', exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`/projects/${alpha}/harness/branch/feat%2Falpha/pages$`));
	await expect(page.getByText('Current · branch tip', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Go to tip', exact: true })).toHaveCount(0);
	await expect(
		categories(page).getByRole('link', { name: 'Services', exact: true })
	).toHaveAttribute('href', `/projects/${alpha}/harness/branch/feat%2Falpha/services`);
});
