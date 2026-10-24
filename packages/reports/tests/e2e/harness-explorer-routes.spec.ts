import { expect, test } from '../../../../test/support/browserTest';
import {
	at,
	branch,
	categories,
	checkpoint,
	commit,
	expectScope,
	explorer,
	nav,
	pathOf,
	tip
} from './support/explorer';
import { seeded } from './support/harnessHistory';

const { commits, keptBranch } = seeded();
const { explorerBranch, explorerUnits: units } = explorer();
const dropped = /^(reports?|project reports|analytics|activity|growth|compare|component map)$/i;

test('the explorer has its expected navigation, pages first, and no unrelated destinations', async ({
	page
}) => {
	await page.goto('/harness');
	await checkpoint(page, 'routes-categories');
	expect(pathOf(page)).toBe('/harness/branch/main/pages');
	await expect(nav(page).locator('a, button')).toHaveText(categories);
	await expect(nav(page).getByRole('link', { name: 'Pages' })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await expect(page.getByRole('link', { name: dropped })).toHaveCount(0);
	await expect(page.getByRole('tab', { name: dropped })).toHaveCount(0);
});

test('an earlier map page of a commit opens the entity in the explorer, without its source', async ({
	page
}) => {
	// The address the console had for a selected unit before the explorer.
	await page.goto(`/harness/branch/main/commit/${commits.approved}/map/unit/${units.slugify}`);
	await checkpoint(page, 'routes-earlier-map');
	expect(pathOf(page)).toBe(at('main', commits.approved, `functions/${units.slugify}`));
	await expect(nav(page).locator('a, button')).toHaveText(categories);
	await expect(page.getByRole('link', { name: dropped })).toHaveCount(0);
	await expect(page.getByRole('heading', { level: 1, name: 'slugify' })).toBeVisible();
	// A commit subject in the selector may name a file; what the entity shows does not.
	const content = page.locator('.ex-content');
	await expect(content.getByText('src/utils/slugify.ts')).toHaveCount(0);
	await expect(content.getByText(/\d\s?%/)).toHaveCount(0);
});

test('a branch address follows its tip, a chosen commit has its own address, and Go to tip returns', async ({
	page
}) => {
	await page.goto(tip('main', 'functions'));
	await checkpoint(page, 'routes-current-tip');
	await expect(branch(page)).toHaveValue('main');
	const current = {
		tip: commits.sourceOnly,
		viewed: commits.sourceOnly,
		label: 'Current · branch tip'
	};
	await expectScope(page, current);
	await expect(page.getByRole('button', { name: 'Go to tip' })).toBeDisabled();

	await commit(page).selectOption(commits.approved);
	await expect(page).toHaveURL(new RegExp(`${at('main', commits.approved, 'functions')}$`));
	const selected = {
		tip: commits.sourceOnly,
		viewed: commits.approved,
		label: 'Historical commit'
	};
	await expectScope(page, selected);
	await checkpoint(page, 'routes-selected-commit');

	await page.reload();
	await expectScope(page, selected);
	await page.getByRole('link', { name: 'Go to tip' }).click();
	await expect(page).toHaveURL(new RegExp(`${tip('main', 'functions')}$`));
	await expectScope(page, current);
	await page.goBack();
	await expectScope(page, selected);
	await page.goForward();
	await expectScope(page, current);
});

test('a branch is one encoded segment, and another branch opens at its own tip', async ({
	page
}) => {
	await page.goto(tip(explorerBranch, 'components'));
	expect(pathOf(page)).toBe('/harness/branch/explorer%2Ftip/components');
	const verified = {
		tip: commits.approved,
		viewed: commits.approved,
		label: 'Current · branch tip'
	};
	await expectScope(page, verified);

	await branch(page).selectOption(keptBranch);
	await expect(page).toHaveURL(/\/harness\/branch\/feature%2Fkept%231\/components$/);
	const kept = { tip: commits.kept, viewed: commits.kept, label: 'Current · branch tip' };
	await expectScope(page, kept);
	await checkpoint(page, 'routes-branch-change');
	await page.reload();
	await expectScope(page, kept);
	await expect(nav(page).getByRole('link', { name: 'Code' })).toHaveAttribute(
		'aria-current',
		'page'
	);
});

test('earlier addresses, reports and analytics all lead into the explorer', async ({ page }) => {
	const home = tip('main', 'pages');
	const leads: Array<[string, string]> = [
		[
			`/harness?view=history&commit=${commits.reordered}&unit=service.title`,
			at('main', commits.reordered, 'services/service.title/history')
		],
		[
			`/harness/branch/feature/kept%231/commit/${commits.kept}/growth`,
			at(keptBranch, commits.kept, 'pages')
		],
		[
			`/harness/branch/main/commit/${commits.shout}/compare/${commits.baseline}`,
			at('main', commits.shout, 'pages')
		],
		[`/harness/branch/${encodeURIComponent(explorerBranch)}`, tip(explorerBranch, 'pages')],
		['/harness/reports', home],
		['/harness/reports/no-such-report', home],
		['/harness/analytics', home],
		['/analytics', home],
		['/', home]
	];
	for (const [from, to] of leads) {
		await page.goto(from);
		await expect(page, from).toHaveURL(new RegExp(`${to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
		await expect(nav(page).locator('a, button'), from).toHaveText(categories);
	}
	await checkpoint(page, 'routes-earlier-addresses');
});

test('what the history does not hold is said, and no other revision is shown in its place', async ({
	page
}) => {
	await page.goto(tip('nowhere', 'pages'));
	await expect(page.getByRole('alert')).toContainText('Branch nowhere is not in this history.');
	await page.goto(at('main', commits.kept, 'pages'));
	await expect(page.getByRole('alert')).toContainText('Branch main does not contain commit');

	// The loader was added after the baseline: at the baseline it is absent, and stays absent.
	const absent = at('main', commits.baseline, 'functions/function.extra');
	await page.goto(absent);
	await checkpoint(page, 'routes-absent-entity');
	await expect(
		page.getByText('Nothing from another revision is shown in its place.')
	).toBeVisible();
	expect(pathOf(page)).toBe(absent);
	await expect(commit(page)).toHaveValue(commits.baseline);
});
