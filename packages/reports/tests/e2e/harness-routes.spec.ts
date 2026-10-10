import { expect, test, type Page } from '@playwright/test';
import { seeded } from './support/harnessHistory';

const { commits, keptBranch } = seeded();
const lockedPort = Number(process.env.HARNESS_CONSOLE_E2E_LOCKED_PORT || 5591);
const main = (commit: string, rest: string) => `/harness/branch/main/commit/${commit}/${rest}`;
const kept = `/harness/branch/feature/kept%231/commit/${commits.kept}`;
const pathOf = (page: Page) => new URL(page.url()).pathname;
const search = (page: Page) => new URL(page.url()).search;
const tab = (page: Page) => page.getByRole('tab', { selected: true });
const commit = (page: Page) => page.getByRole('combobox', { name: 'Commit' });
const branch = (page: Page) => page.getByRole('combobox', { name: 'Branch' });
const details = (page: Page) => page.getByRole('region', { name: 'Component details' });

test('the root and the earlier query addresses lead to a page with its own path', async ({
	page
}) => {
	await page.goto('/harness');
	await expect(page).toHaveURL(new RegExp(`${main(commits.sourceOnly, 'map')}$`));
	await expect(tab(page)).toHaveText('Component map');

	await page.goto(`/harness?view=history&commit=${commits.reordered}&unit=service.title`);
	expect([pathOf(page), search(page)]).toEqual([
		main(commits.reordered, 'history/unit/service.title'),
		''
	]);
	await expect(tab(page)).toHaveText('History');
	await expect(commit(page)).toHaveValue(commits.reordered);

	await page.goto(`/harness?view=compare&base=${commits.baseline}&commit=${commits.shout}`);
	expect(pathOf(page)).toBe(main(commits.shout, `compare/${commits.baseline}`));
	await expect(page.getByRole('combobox', { name: 'Base commit' })).toHaveValue(commits.baseline);
});

test('every branch, commit, view and selection is a path that reloads and goes back and forward', async ({
	page
}) => {
	await page.goto(main(commits.reordered, 'map'));
	await expect(commit(page)).toHaveValue(commits.reordered);
	await page
		.getByRole('list', { name: 'Components' })
		.getByRole('button', { name: /^service\.title/ })
		.click();
	await expect(page).toHaveURL(new RegExp(`${main(commits.reordered, 'map/unit/service.title')}$`));
	await page.getByRole('tab', { name: 'History' }).click();
	await expect(page).toHaveURL(
		new RegExp(`${main(commits.reordered, 'history/unit/service.title')}$`)
	);
	await commit(page).selectOption(commits.shout);
	await expect(page).toHaveURL(new RegExp(`${main(commits.shout, 'history/unit/service.title')}$`));
	await expect(page.getByRole('region', { name: 'Recorded verification' })).toContainText(
		commits.shout
	);

	// A reload stays on the page; back and forward walk the same pages again.
	await page.reload();
	await expect(tab(page)).toHaveText('History');
	await expect(commit(page)).toHaveValue(commits.shout);
	await page.goBack();
	await expect(page).toHaveURL(
		new RegExp(`${main(commits.reordered, 'history/unit/service.title')}$`)
	);
	await expect(commit(page)).toHaveValue(commits.reordered);
	await page.goBack();
	await expect(tab(page)).toHaveText('Component map');
	await expect(details(page).getByRole('heading', { name: 'service.title' })).toBeVisible();
	await page.goForward();
	await page.goForward();
	await expect(commit(page)).toHaveValue(commits.shout);
	await expect(tab(page)).toHaveText('History');
});

test('a comparison, a record and a growth view each have a direct link', async ({ page }) => {
	await page.goto(main(commits.shout, 'compare'));
	// The base that is shown becomes part of the address, without a second history entry.
	await expect(page).toHaveURL(
		new RegExp(`${main(commits.shout, `compare/${commits.baseline}`)}$`)
	);
	await page.getByRole('combobox', { name: 'Base commit' }).selectOption(commits.unbaselined);
	await expect(page).toHaveURL(
		new RegExp(`${main(commits.shout, `compare/${commits.unbaselined}`)}$`)
	);

	await page.goto(main(commits.reordered, 'history'));
	const records = page.getByRole('list', { name: 'Verification records' });
	await records
		.getByRole('listitem')
		.filter({ hasText: 'Failed' })
		.first()
		.getByRole('button')
		.click();
	await expect(page).toHaveURL(
		new RegExp(`${main(commits.reordered, 'history/record/')}[0-9a-f]{64}$`)
	);
	const linked = pathOf(page);
	const id = linked.split('/').pop() ?? '';
	await page.goto(linked);
	await expect(
		page.getByRole('heading', { name: `Scenarios of record ${id.slice(0, 12)}` })
	).toBeVisible();

	await page.goto(main(commits.reordered, 'growth/unit/function.slugify'));
	await expect(page.getByRole('table', { name: 'Growth of function.slugify' })).toBeVisible();
	await page.getByRole('combobox', { name: 'Component' }).selectOption('service.title');
	await expect(page).toHaveURL(
		new RegExp(`${main(commits.reordered, 'growth/unit/service.title')}$`)
	);
});

test('a branch name with a slash is one branch, and a commit on no branch gets no branch', async ({
	page
}) => {
	expect(keptBranch).toBe('feature/kept#1');
	await page.goto(`${kept}/map`);
	await expect(branch(page)).toHaveValue(keptBranch);
	await expect(commit(page)).toHaveValue(commits.kept);
	await expect(commit(page).locator(`option[value="${commits.reordered}"]`)).toHaveCount(0);
	await branch(page).selectOption('main');
	await expect(page).toHaveURL(new RegExp(`${main(commits.sourceOnly, 'map')}$`));
	await branch(page).selectOption(keptBranch);
	await expect(page).toHaveURL(new RegExp(`${kept}/map$`));

	await branch(page).selectOption('Retained commits');
	await expect(page).toHaveURL(new RegExp(`/harness/commit/${commits.retained}/map$`));
	await page.reload();
	await expect(branch(page)).toHaveValue('Retained commits');
	await expect(commit(page)).toHaveValue(commits.retained);
	// A commit that is on a branch is not left under the branchless address.
	await page.goto(`/harness/commit/${commits.reordered}/history`);
	await expect(page).toHaveURL(new RegExp(`${main(commits.reordered, 'history')}$`));
});

test('an address that names nothing in this history says so and offers the way back', async ({
	page
}) => {
	const cases: Array<[string, string]> = [
		[main('0'.repeat(40), 'map'), 'Commit 0000000 is not in this history.'],
		[
			`/harness/branch/nowhere/commit/${commits.reordered}/map`,
			'Branch nowhere does not contain commit'
		],
		[`${kept.replace(commits.kept, commits.reordered)}/map`, 'does not contain commit'],
		[main(commits.reordered, 'bogus'), 'This address names no page of the console.'],
		['/harness/branch/main', 'This address names no page of the console.']
	];
	for (const [address, message] of cases) {
		await page.goto(address);
		await expect(page.getByRole('alert')).toContainText(message);
		await expect(page.getByRole('tab')).toHaveCount(0);
		await page.getByRole('link', { name: 'Open the newest commit' }).click();
		await expect(page).toHaveURL(new RegExp(`${main(commits.sourceOnly, 'map')}$`));
	}
});

test('page paths are refused without the owner policy, like every other address', async ({
	request
}) => {
	const addresses = [
		main(commits.reordered, 'map'),
		main(commits.reordered, 'history/unit/service.title'),
		`${kept}/map`,
		`/harness/commit/${commits.retained}/map`,
		`/harness?view=history&commit=${commits.reordered}`
	];
	for (const address of addresses) {
		const response = await request.get(`http://127.0.0.1:${lockedPort}${address}`, {
			maxRedirects: 0
		});
		expect([address, response.status()]).toEqual([address, 403]);
		expect(await response.text()).not.toContain(commits.reordered);
	}
});

test('the pages keep to a phone width', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	for (const address of [
		`${kept}/map`,
		main(commits.reordered, 'history'),
		main(commits.shout, 'compare')
	]) {
		await page.goto(address);
		await expect(tab(page)).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
	}
});

test('on a phone all four views can be seen and chosen without scrolling anything sideways', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	const names = ['Component map', 'Compare', 'History', 'Growth'];
	const views = ['map', 'compare', 'history', 'growth'];
	await page.goto(main(commits.reordered, 'history'));
	const strip = page.getByRole('tablist', { name: 'Views' });
	await expect(strip.getByRole('tab')).toHaveText(names);
	for (const name of names) {
		// Each choice lies wholly inside the screen and is large enough to tap.
		const box = await strip.getByRole('tab', { name, exact: true }).boundingBox();
		expect([
			name,
			Math.floor(box?.x ?? -1) >= 0,
			Math.ceil((box?.x ?? 0) + (box?.width ?? 999)) <= 390
		]).toEqual([name, true, true]);
		expect([name, (box?.height ?? 0) >= 44]).toEqual([name, true]);
	}
	expect(await strip.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
	for (const [index, name] of names.entries()) {
		await strip.getByRole('tab', { name, exact: true }).click();
		await expect(page).toHaveURL(new RegExp(`/commit/${commits.reordered}/${views[index]}`));
		await expect(tab(page)).toHaveText(name);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
	}
});
