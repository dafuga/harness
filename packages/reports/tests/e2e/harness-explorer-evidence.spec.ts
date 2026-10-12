import { expect, test, type Page } from '@playwright/test';
import {
	at,
	checkpoint,
	expectNoOverflow,
	expectPath,
	explorer,
	tip,
	verdict
} from './support/explorer';
import { viewports } from './support/harnessCapture';
import { seeded, short } from './support/harnessHistory';

const { commits } = seeded();
const { explorerBranch, explorerUnits: units } = explorer();
const main = (rest: string) => at('main', commits.approved, rest);
const content = (page: Page) => page.locator('.ex-content');
const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name });
const passed = (page: Page) => verdict(page, 'Full coverage passed').first();
/** Opens every recorded result a panel keeps behind a control; one that shows them needs none. */
async function reveal(page: Page): Promise<void> {
	const closed = content(page).getByRole('button', { name: /^Show / });
	for (let left = await closed.count(); left > 0; left -= 1) await closed.first().click();
}
/** What the comparison of the recorded results came to, as the panel says it in words. */
const told = (page: Page, label: string) =>
	content(page).getByRole('status').filter({ hasText: label });
const open = (page: Page, name: string) =>
	content(page).getByRole('link', { name, exact: true }).first().click();

test('a page leads to its components, those to components, and those to functions', async ({
	page
}) => {
	await page.goto(main('pages'));
	await open(page, 'Titles');
	await expect(heading(page, 'Titles')).toBeVisible();
	await page.getByRole('tab', { name: 'Relationships' }).click();
	await checkpoint(page, 'evidence-page-relationships');
	for (const section of ['Components', 'Configs', 'Services']) {
		const named = new RegExp(`^${section}`);
		await expect(content(page).getByRole('heading', { name: named })).toBeVisible();
	}
	await expect(content(page).getByText(/sub-?components|^related/i)).toHaveCount(0);
	await open(page, 'Title list');
	await expectPath(page, main(`components/${units.list}`));
	await page.getByRole('tab', { name: 'Relationships' }).click();
	await open(page, 'Title row');
	await expectPath(page, main(`components/${units.row}`));
	await page.getByRole('tab', { name: 'Relationships' }).click();
	await open(page, 'Slugify');
	await expectPath(page, main(`functions/${units.slugify}`));
	await expect(heading(page, 'Slugify')).toBeVisible();
});

test('source is not shown until Details and then Source are opened, on a page too', async ({
	page
}) => {
	const file = 'src/routes/titles/+page.svelte';
	await page.goto(main(`pages/${units.page}`));
	await expect(heading(page, 'Titles')).toBeVisible();
	await expect(content(page).getByText(file)).toHaveCount(0);
	await content(page).getByRole('link', { name: 'Details' }).click();
	await expectPath(page, main(`pages/${units.page}/details`));
	await checkpoint(page, 'evidence-page-details');
	for (const section of ['Contract', 'Size', 'Performance profile']) {
		await expect(content(page).getByRole('heading', { name: section, exact: true })).toBeVisible();
	}
	await expect(page.getByRole('tab')).toHaveText(['Contract', 'Measurements', 'Source', 'History']);
	await expect(content(page).getByText(file)).toHaveCount(0);
	await page.getByRole('tab', { name: 'Source' }).click();
	await expectPath(page, main(`pages/${units.page}/details?tab=source`));
	await expect(content(page).getByText(file).first()).toBeVisible();
	await page.reload();
	await expect(content(page).getByText(file).first()).toBeVisible();
	await checkpoint(page, 'evidence-page-source');
});

test('a verdict is a green check for complete passing evidence and a red cross for anything else', async ({
	page
}) => {
	await page.goto(main(`functions/${units.slugify}`));
	await checkpoint(page, 'evidence-verdict-passed');
	await expect(passed(page)).toBeVisible();
	// The tip of main was never verified: nothing is assumed to pass there.
	await page.goto(tip('main', `functions/${units.slugify}`));
	await checkpoint(page, 'evidence-verdict-missing');
	await expect(verdict(page, 'Evidence missing').first()).toBeVisible();
	// Only the mark is drawn; why it is not proven is told when it is pointed at.
	await verdict(page, 'Evidence missing').first().hover();
	await expect(
		page.getByRole('tooltip').filter({ hasText: 'No verification record' })
	).toBeVisible();
	await expect(passed(page)).toHaveCount(0);
	// The newest record of this commit rejected the audio of the service: its own failure, while
	// the page beside it, whose captures that record accepted, is judged by its own evidence.
	await page.goto(at('main', commits.restated, `services/${units.service}`));
	await expect(heading(page, 'Title service')).toBeVisible();
	await expect(passed(page)).toHaveCount(0);
	// A budget the commit broke is that unit's failure.
	await page.goto(at('main', commits.grown, `functions/${units.slugify}`));
	await expect(verdict(page, 'Verification failed').first()).toBeVisible();
	await expect(content(page).getByText(/\d\s?%|partial|amber/i)).toHaveCount(0);
});

test('a branch tip shows one current screenshot and a selected commit shows parent and selected', async ({
	page
}) => {
	await page.goto(tip(explorerBranch, `pages/${units.page}`));
	await checkpoint(page, 'evidence-current-page');
	await expect(
		content(page).getByText(`Current snapshot · ${short(commits.approved)}`)
	).toBeVisible();
	await expect(content(page).getByText(/^Before ·/)).toHaveCount(0);
	await expect(content(page).locator('img[src*="/harness/media/"]')).toHaveCount(1);
	await content(page).getByRole('group', { name: 'Viewport' }).getByText('Mobile').click();
	await expect(content(page).locator('img[src*="/harness/media/"]')).toHaveCount(1);

	await page.goto(at('main', commits.shout, `pages/${units.page}`));
	await checkpoint(page, 'evidence-commit-page');
	await expect(content(page).getByText(`Before · ${short(commits.baseline)}`)).toBeVisible();
	await expect(content(page).getByText(`After · ${short(commits.shout)}`)).toBeVisible();
	await expect(content(page).locator('img[src*="/harness/media/"]')).toHaveCount(2);
});

test('a component is shown with the states that show it, not every state of its scenario', async ({
	page
}) => {
	// One scenario captures the list and its row; each capture belongs to the component it shows.
	const shots = (state: string) => content(page).locator(`img[alt*="· ${state} at"]`);
	await page.goto(tip(explorerBranch, `components/${units.row}`));
	await expect(heading(page, 'Title row')).toBeVisible();
	await checkpoint(page, 'evidence-own-states');
	await expect(shots('row')).toHaveCount(1);
	await expect(shots('listed')).toHaveCount(0);
	await expect(passed(page)).toBeVisible();
	await page.goto(tip(explorerBranch, `components/${units.list}`));
	await expect(shots('listed')).toHaveCount(1);
	await expect(shots('row')).toHaveCount(0);
});

test('a function shows its end-to-end run before and after, and says whether behaviour changed', async ({
	page
}) => {
	await page.goto(at('main', commits.shout, `functions/${units.slugify}`));
	await checkpoint(page, 'evidence-behavior-changed');
	await expect(told(page, 'Behavior changed')).toBeVisible();
	await expect(content(page).getByText(`Before · ${short(commits.baseline)}`)).toBeVisible();
	await reveal(page);
	await expect(content(page).getByText('hello world').first()).toBeVisible();
	await expect(content(page).getByText('HELLO WORLD').first()).toBeVisible();
	await expect(content(page).getByText('Surrounding spaces are removed').first()).toBeVisible();

	await page.goto(main(`functions/${units.slugify}`));
	await checkpoint(page, 'evidence-behavior-unchanged');
	await expect(told(page, 'Behavior unchanged')).toBeVisible();
	await page.goto(tip(explorerBranch, `functions/${units.slugify}`));
	await expect(content(page).getByText(/^Before ·/)).toHaveCount(0);
	await reveal(page);
	await expect(content(page).getByText('Slugify each title').first()).toBeVisible();
});

test('the history of an entity lists the commits behind the shown one, with growth and approvals', async ({
	page
}) => {
	await page.goto(main(`functions/${units.slugify}/history`));
	await checkpoint(page, 'evidence-history');
	// A row of the table is the one that names the commit in a cell of its own.
	const rows = content(page).locator('tbody tr');
	const of = (sha: string) => rows.filter({ has: page.getByText(short(sha), { exact: true }) });
	await expect(of(commits.grown).first()).toContainText('Budget increase approved');
	// A later commit of the branch is not part of the history of an earlier one.
	await expect(of(commits.reordered)).toHaveCount(0);
	// This commit changed what the function returns without changing its size: it is listed.
	await of(commits.shout)
		.getByRole('link', { name: /View revision/ })
		.first()
		.click();
	await expectPath(page, at('main', commits.shout, `functions/${units.slugify}`));
});

for (const viewport of viewports.filter((item) => item.id !== 'desktop')) {
	test(`the explorer is usable at ${viewport.id} width without scrolling sideways`, async ({
		page
	}) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		for (const rest of ['pages', `pages/${units.page}`, `functions/${units.slugify}/details`]) {
			await page.goto(main(rest));
			await expect(content(page)).toBeVisible();
			await checkpoint(page, `evidence-${viewport.id}-${rest.split('/').length}`);
			await expectNoOverflow(page);
		}
		await page.getByRole('combobox', { name: 'Branch' }).selectOption(explorerBranch);
		await expect(page).toHaveURL(/\/harness\/branch\/explorer%2Ftip\//);
	});
}
