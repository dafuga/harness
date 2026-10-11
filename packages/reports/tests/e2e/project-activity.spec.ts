import { expect, test, type Locator, type Page } from '@playwright/test';
import { activityFixture, type ActivityFixture } from './support/activityFixture';
import { fixtures } from './support/fixtures';
import { seeded } from './support/harnessHistory';
import { fits, pictured, screens } from './support/sharedSelect';

/**
 * The analytics of a site are about the application it is hosted for: who is working in its
 * checkouts now and on what, the loop types it uses, its recent commits with their reasons, and
 * the files that changed, committed or not. Nothing of another application is shown or served.
 */
const lockedPort = Number(process.env.HARNESS_CONSOLE_E2E_LOCKED_PORT || 5591);
const locked = (path: string) => `http://127.0.0.1:${lockedPort}${path}`;
const foreign = encodeURIComponent(fixtures.site('beta-project'));
const { commits } = seeded();
const short = (commit: string) => commit.slice(0, 7);
const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
const item = (list: Locator, text: string) => list.getByRole('listitem').filter({ hasText: text });
let made: ActivityFixture;

test.beforeAll(() => {
	made = activityFixture();
	// The quiet helper stated one second of patience; by now it has said nothing for longer.
	return new Promise((resolve) => setTimeout(resolve, 1500));
});

for (const [screen, width, height] of screens) {
	test(`analytics name the hosting repository and who is working in it on what at ${screen} width`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height });
		await page.goto('/harness/analytics');
		await expect(
			page.getByRole('heading', { name: 'Harness Analytics', exact: true })
		).toBeVisible();
		await pictured(page, `project-activity-${screen}`);
		await expect(page.getByText('Analytics of alpha-project', { exact: true })).toBeVisible();
		const identity = page.getByLabel('Repository', { exact: true });
		await expect(identity).toContainText('alpha-project');
		await expect(identity).toContainText(`branch main · ${short(made.commits.second)}`);

		const agents = region(page, 'Working agents');
		await expect(agents.getByTestId('agents-working')).toHaveText('1');
		await expect(agents).toContainText('1 registered agent is working');
		const roster = agents.getByRole('list', { name: 'Agent roster' });
		const working = item(roster, 'Opus session');
		await expect(working).toContainText('Working');
		await expect(working).toContainText('anthropic · claude-opus-5-5');
		await expect(working).toContainText('alpha-checkout · branch checkout');
		await expect(working).toContainText('Cart totals');
		await expect(working).toContainText('service.cart');
		// A registration that went quiet, or ended, is shown as that and is not counted.
		await expect(item(roster, 'Quiet helper')).toContainText('Stale');
		await expect(item(roster, 'Finisher')).toContainText('Finished');
		await expect(item(roster, 'Finisher')).toContainText('Handed over');
		await expect(page.locator('body')).not.toContainText('Foreign agent');
		await expect(page.locator('body')).not.toContainText('foreign-model');
		await expect(page.locator('body')).not.toContainText('beta-project');
		// What the project is doing comes before the totals of its history.
		const above = (await agents.boundingBox())!.y;
		const totals = page.getByRole('heading', { name: 'Overview', exact: true });
		expect(above).toBeLessThan((await totals.boundingBox())!.y);
		expect(await fits(page)).toBe(true);
	});

	test(`loop types, recent work and changed files lead into the history of the repository at ${screen} width`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height });
		await page.goto('/harness/analytics');
		const loops = region(page, 'Loop types').getByRole('list', { name: 'Loop types' });
		await expect(item(loops, 'feature')).toContainText('2 loops · 1 complete · 1 open');
		await expect(item(loops, 'bug-fix')).toContainText('1 loop · 0 complete · 1 open');

		const work = region(page, 'Recent work').getByRole('list', { name: 'Recent commits' });
		const latest = work.getByRole('listitem').first();
		await latest.scrollIntoViewIfNeeded();
		await pictured(page, `project-activity-work-${screen}`);
		await expect(latest).toContainText('feat: triple the price');
		await expect(latest).toContainText('Prices are tripled.');
		await expect(latest).toContainText('function.price');
		await expect(item(work, 'feat: prices and a cart')).toContainText('No reason is noted');

		const files = region(page, 'Recently changed files');
		const committed = files.getByRole('list', { name: 'Committed files', exact: true });
		await expect(item(committed, 'src/utils/price.ts')).toContainText('function.price');
		await expect(item(committed, 'draft-notes.txt')).toHaveCount(0);
		const open = files.getByRole('list', { name: 'Uncommitted files' });
		await expect(files).toContainText('alpha-checkout · branch checkout');
		await expect(item(open, 'src/services/CartService.ts')).toContainText('service.cart');
		await expect(item(open, 'draft-notes.txt')).toContainText('untracked');

		// A commit is a page of the console of this repository, at its own path.
		const link = latest.getByRole('link', { name: short(made.commits.second) });
		const path = `/harness/branch/main/commit/${made.commits.second}/history`;
		await expect(link).toHaveAttribute('href', path);
		await link.click();
		await expect(page).toHaveURL(new RegExp(`${path}$`));
		await page.goBack();
		await expect(
			page.getByRole('heading', { name: 'Harness Analytics', exact: true })
		).toBeVisible();
		expect(await fits(page)).toBe(true);
	});

	test(`a console shows the activity recorded with its history, and says live activity is not in it, at ${screen} width`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height });
		await page.goto(`/harness/branch/main/commit/${commits.sourceOnly}/map`);
		await page.getByRole('tab', { name: 'Activity', exact: true }).click();
		await expect(page).toHaveURL(new RegExp(`/commit/${commits.sourceOnly}/activity$`));
		await expect(page.getByRole('tab', { selected: true })).toHaveText('Activity');
		const work = region(page, 'Recent work').getByRole('list', { name: 'Recent commits' });
		await expect(work.getByRole('link', { name: short(commits.sourceOnly) })).toBeVisible();
		await pictured(page, `console-activity-${screen}`);
		await expect(region(page, 'Working agents')).toContainText('not part of a recorded history');
		await expect(page.getByTestId('agents-working')).toHaveCount(0);
		await expect(region(page, 'Recently changed files')).toContainText(
			'Uncommitted changes are not part of a recorded history'
		);
		await page.reload();
		await expect(page.getByRole('tab', { selected: true })).toHaveText('Activity');
		expect(await fits(page)).toBe(true);
	});
}

test('activity is served to the owner only and for this repository only, whatever the address asks', async ({
	page,
	request
}) => {
	const own = await request.get('/api/project-activity');
	expect(own.status()).toBe(200);
	const text = await own.text();
	const body = JSON.parse(text) as {
		activity: { repository: { name: string } };
		live: { agents: { working: number | null; roster: Array<{ label: string }> } };
	};
	expect([body.activity.repository.name, body.live.agents.working]).toEqual(['alpha-project', 1]);
	// Neither another application nor where things are on this machine leaves the server.
	expect(text).not.toMatch(/Foreign agent|foreign-model|beta-project/);
	expect(text).not.toContain(fixtures.root);
	const asked = await request.get(
		`/api/project-activity?project=${foreign}&site=${foreign}&root=${foreign}`
	);
	expect(await asked.text()).not.toMatch(/Foreign agent|foreign-model|beta-project/);
	expect((JSON.parse(await asked.text()) as typeof body).activity.repository.name).toBe(
		'alpha-project'
	);
	await page.goto(`/harness/analytics?project=${foreign}`);
	await expect(page.getByText('Analytics of alpha-project', { exact: true })).toBeVisible();
	await expect(page.locator('body')).not.toContainText('Foreign agent');
	// Nothing is registered or changed over the network: the page only reads.
	expect((await request.post('/api/project-activity', { data: {} })).status()).toBe(405);
	// A server that admits no owner gives neither the page nor its data.
	for (const path of [
		'/api/project-activity',
		'/harness/analytics',
		'/harness/data/activity.json'
	]) {
		const refused = await request.get(locked(path));
		expect([path, refused.status()]).toEqual([path, 403]);
		expect(await refused.text()).not.toContain('alpha-project');
	}
});
