import { expect, test, type Page, type TestInfo } from '../../../../test/support/browserTest';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { evidenced } from './ui-search-evidence';
import { alpha, beta, earlier, searchFixture } from './ui-search-fixture';

/**
 * The search while the workspace changes under it: a project or a commit followed in place with
 * the results open and the next read delayed, the project agent's draft beside it, a result opened
 * in another tab, a long name on a phone, and the place of the search in the bar of a wide desktop.
 * A screenshot is kept when TAKE_SCREENSHOT=true.
 */
const alphaAt = (rest: string) => `/projects/${alpha}/harness/branch/feat%2Falpha/${rest}`;
const field = (page: Page) =>
	page
		.getByRole('dialog', { name: 'Search project' })
		.getByRole('combobox', { name: 'Search entities', exact: true });
const found = (page: Page) => page.getByRole('listbox', { name: 'Entities found', exact: true });
const options = (page: Page) => found(page).getByRole('option');
const long =
	'Reconciliation schedule for overnight settlement batches across every regional ledger and currency';

/** Reads that answer only after `__scopeDelay`, and one more Alpha entity with a long name. */
function slowed(name: string) {
	const host = window as unknown as {
		__scopeDelay?: number;
		harness: Record<string, (input: unknown) => Promise<unknown>>;
		__projects: { data: { projects: Array<{ entities: Array<Record<string, unknown>> }> } };
	};
	const base = host.__projects.data.projects[0].entities[1];
	host.__projects.data.projects[0].entities.push({
		...base,
		id: 'app.config.reconciliation',
		category: 'configs',
		kind: 'config',
		title: name,
		summary: name,
		threads: [],
		versions: []
	});
	for (const op of ['snapshot', 'selectProject']) {
		const read = host.harness[op];
		host.harness[op] = async (input) => {
			await new Promise((done) => setTimeout(done, host.__scopeDelay ?? 0));
			return read(input);
		};
	}
}
async function opened(page: Page, info: TestInfo, at: string, name: string) {
	await searchFixture(page);
	await page.addInitScript(slowed, long);
	await page.goto(at);
	await expect(page.getByRole('navigation', { name: 'Catalog categories' })).toBeVisible();
	await remember(page, info, `ready-${name}`);
	await page.getByRole('button', { name: 'Search entities', exact: true }).click();
}
/** Follows an address in place, as back and forward do, with the next reads delayed. */
async function followed(page: Page, path: string) {
	await page.evaluate((to) => {
		(window as unknown as { __scopeDelay: number }).__scopeDelay = 900;
		history.pushState({}, '', to);
		dispatchEvent(new PopStateEvent('popstate'));
	}, path);
}
async function remember(page: Page, info: TestInfo, name: string): Promise<void> {
	await page.evaluate(() => document.fonts.ready.then(() => undefined));
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const folder = process.env.SEARCH_SHOTS ?? info.outputDir;
	mkdirSync(folder, { recursive: true });
	const file = `${process.env.SCREENSHOT_LABEL ?? 'run'}-${name}.png`;
	await page.screenshot({ path: join(folder, file), fullPage: true, animations: 'disabled' });
}

test('while another project loads, no result of the project left is offered', async ({
	page
}, info) => {
	await opened(page, info, alphaAt('pages'), 'search-project-change');
	await field(page).fill('alpha');
	await expect(options(page)).toHaveCount(6);
	await followed(page, `/projects/${beta}/harness/branch/main/pages`);
	await expect(page.getByText('Loading entities…').first()).toBeVisible();
	await expect(options(page)).toHaveCount(0);
	await remember(page, info, 'search-project-loading');
	await evidenced(page, 'search-project-loading');
	await expect(page.getByText('No entity matches “alpha”')).toBeVisible();
	await field(page).fill('only');
	await expect(options(page)).toHaveText([/Function.*Beta only function/]);
});

test('while another commit loads, no result of the tip is offered, then only that commit is', async ({
	page
}, info) => {
	await opened(page, info, alphaAt('pages'), 'search-commit-change');
	await field(page).fill('format');
	await expect(options(page)).toHaveText([/Function.*Alpha format time/]);
	await followed(page, alphaAt(`commit/${earlier}/pages`));
	await expect(options(page)).toHaveCount(0);
	await expect(page.getByText('Loading entities…').first()).toBeVisible();
	await expect(page.getByText('No entity matches “format”')).toBeVisible();
	await expect(field(page)).toHaveAttribute('placeholder', 'Search at ccccccc');
	await field(page).fill('legacy');
	await field(page).press('Enter');
	await expect(page).toHaveURL(alphaAt(`commit/${earlier}/functions/app.function.legacy-totals`));
});

test('Escape in the search leaves the project agent and its draft as they were', async ({
	page
}, info) => {
	await opened(page, info, alphaAt('pages'), 'search-agent-draft');
	await field(page).press('Escape');
	await page.getByRole('button', { name: 'Work with agent', exact: true }).click();
	const agent = page.getByRole('complementary', { name: 'Project agent', exact: true });
	await agent.getByRole('textbox', { name: 'Message', exact: true }).fill('Keep this draft');
	await page.getByRole('button', { name: 'Search entities', exact: true }).click();
	await field(page).fill('alpha');
	await field(page).press('Escape');
	await expect(found(page)).toBeHidden();
	await expect(agent).toBeVisible();
	await expect(agent.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue(
		'Keep this draft'
	);
});

test('a result opened with a modifier opens its address in another tab and leaves this one', async ({
	page
}, info) => {
	await opened(page, info, alphaAt('pages'), 'search-new-tab');
	await field(page).fill('refund');
	const [tab] = await Promise.all([
		page.context().waitForEvent('page'),
		options(page)
			.first()
			.getByRole('link')
			.click({ modifiers: ['ControlOrMeta'] })
	]);
	await tab.waitForLoadState();
	expect(new URL(tab.url()).pathname).toBe(alphaAt('services/app.service.refunds'));
	await expect(page).toHaveURL(alphaAt('pages'));
});

test('a long name wraps inside the results on a phone, which stay inside the screen', async ({
	page
}, info) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await opened(page, info, alphaAt('pages'), 'search-long-mobile');
	await field(page).fill('reconciliation');
	await expect(options(page)).toHaveText([new RegExp(`Config.*${long}`)]);
	await remember(page, info, 'search-long-mobile');
	const box = await found(page).boundingBox();
	expect(box && box.x >= 0 && box.x + box.width <= 390).toBe(true);
	expect(await found(page).evaluate((list) => list.scrollWidth <= list.clientWidth)).toBe(true);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('at a wide desktop the search shares the one row of the top bar, overlapping nothing', async ({
	page
}, info) => {
	await opened(page, info, alphaAt('pages'), 'search-fit-desktop');
	await field(page).press('Escape');
	const bar = page.getByRole('banner');
	const revision = () =>
		Promise.all(
			['Branch', 'Commit'].map(async (name) =>
				Math.round((await bar.getByRole('combobox', { name, exact: true }).boundingBox())!.width)
			)
		);
	// The branch and commit fields keep the width a wider screen gives them: the search squeezes neither.
	await page.setViewportSize({ width: 1920, height: 900 });
	const natural = await revision();
	await page.setViewportSize({ width: 1440, height: 900 });
	expect(await revision()).toEqual(natural);
	const [search, branch, row] = [
		(await bar.getByRole('button', { name: 'Search entities', exact: true }).boundingBox())!,
		(await bar.getByRole('combobox', { name: 'Branch', exact: true }).boundingBox())!,
		(await bar.getByRole('navigation', { name: 'Catalog categories' }).boundingBox())!
	];
	type Box = typeof row;
	// The layout of a wide desktop is one row: the field and the branch field lie in the row of the
	// categories, as the branch field did before the search.
	const within = (item: Box) => item.y >= row.y && item.y + item.height <= row.y + row.height;
	expect([within(search), within(branch)]).toEqual([true, true]);
	// The field, with its focus ring of three pixels, and the branch field meet on neither axis.
	const ring = 3;
	const meet = (one: Box, two: Box) =>
		one.x - ring < two.x + two.width &&
		two.x < one.x + one.width + ring &&
		one.y - ring < two.y + two.height &&
		two.y < one.y + one.height + ring;
	expect(meet(search, branch)).toBe(false);
	expect(search.width).toBeGreaterThanOrEqual(40);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
});
