import { expect, test, type Page } from '@playwright/test';
import { brief, revision, seeded } from './support/harnessHistory';
import { fits, pictured, screens, sharedField, typed } from './support/sharedSelect';

/**
 * Every choice in the console is the one shared select: the branch, commit and base of the
 * page, what a comparison shows and the component whose growth is read. Each still leads where
 * it led: to a path of its own, or to the states that were recorded.
 */
const { commits, keptBranch } = seeded();
const main = (commit: string, rest: string) => `/harness/branch/main/commit/${commit}/${rest}`;
const kept = `/harness/branch/feature/kept%231/commit/${commits.kept}`;
const combo = (page: Page, name: string) => page.getByRole('combobox', { name, exact: true });
const at = (path: string) => new RegExp(`${path}$`);
const states = (page: Page) =>
	page.getByRole('region', { name: 'Recorded states, before and after' });

for (const [screen, width, height] of screens) {
	test(`the console selectors are the shared select and each choice is a path at ${screen} width`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height });
		await page.goto(main(commits.shout, `compare/${commits.baseline}`));
		const base = combo(page, 'Base commit');
		const [branch, commit] = [combo(page, 'Branch'), combo(page, 'Commit')];
		await expect(base).toHaveValue(commits.baseline);
		await pictured(page, `console-selectors-${screen}`);
		for (const field of [branch, commit, base]) await sharedField(field);
		await base.selectOption(commits.unbaselined);
		await expect(page).toHaveURL(at(main(commits.shout, `compare/${commits.unbaselined}`)));
		await expect(base).toHaveValue(commits.unbaselined);

		await page.goto(main(commits.reordered, 'map'));
		await expect(commit).toHaveValue(commits.reordered);
		await commit.selectOption(commits.shout);
		await expect(page).toHaveURL(at(main(commits.shout, 'map')));
		// A branch is chosen from the keyboard, and the keyboard stays in the field it used.
		await typed(page, branch, 'f');
		await expect(page).toHaveURL(at(`${kept}/map`));
		await expect(branch).toHaveValue(keptBranch);
		await expect(branch).toBeFocused();
		await expect(commit).toHaveValue(commits.kept);
		await pictured(page, `console-branch-chosen-${screen}`);
		await branch.selectOption('main');
		await expect(page).toHaveURL(at(main(commits.sourceOnly, 'map')));
		expect(await fits(page)).toBe(true);
	});

	test(`the comparison choices are the shared select and show what was recorded at ${screen} width`, async ({
		page
	}) => {
		const skipped = revision(commits.reordered).records.find((record) =>
			record.failures.some((text) => /missing screenshot for state filled/.test(text))
		);
		await page.setViewportSize({ width, height });
		await page.goto(`/harness?view=compare&base=${commits.removed}&commit=${commits.reordered}`);
		const pick = (name: string) => states(page).getByRole('combobox', { name, exact: true });
		// The page scenario has viewports, and this commit has more than one record to choose from.
		await pick('Scenario').selectOption('titles-page');
		await pick('Head record').selectOption(skipped?.id ?? '');
		await pick('Scenario').scrollIntoViewIfNeeded();
		await pictured(page, `console-comparison-${screen}`);
		for (const name of ['Scenario', 'State', 'Viewport', 'Head record'])
			await sharedField(pick(name));
		await typed(page, pick('State'), 'f');
		await expect(pick('State')).toHaveValue('filled');
		await typed(page, pick('Viewport'), 'm');
		await expect(pick('Viewport')).toHaveValue('mobile');
		const aligned = states(page).getByRole('list', { name: 'Aligned states' });
		await expect(aligned.getByRole('listitem')).toContainText(
			`after: no capture of filled at mobile in record ${brief(skipped?.id ?? '')}`
		);
		await pictured(page, `console-comparison-chosen-${screen}`);
		expect(await fits(page)).toBe(true);
	});

	test(`the growth component is the shared select and its choice is a path at ${screen} width`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height });
		await page.goto(main(commits.reordered, 'growth/unit/function.slugify'));
		const component = combo(page, 'Component');
		await expect(page.getByRole('table', { name: 'Growth of function.slugify' })).toBeVisible();
		await pictured(page, `console-growth-${screen}`);
		await sharedField(component);
		await component.selectOption('service.title');
		await expect(page).toHaveURL(at(main(commits.reordered, 'growth/unit/service.title')));
		await expect(component).toHaveValue('service.title');
		await expect(page.getByRole('table', { name: 'Growth of service.title' })).toBeVisible();
		expect(await fits(page)).toBe(true);
	});
}
