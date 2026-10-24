import { expect, type Page } from '@playwright/test';
import { shellUnit as unit, shellsBranch } from '../../../scripts/harness-shells-seed';
import { at, expectPath, nav, tip } from './explorer';
import { seeded } from './harnessHistory';

const { commits } = seeded();
const content = (page: Page) => page.locator('.ex-content');
const titled = (page: Page, name: string) =>
	expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
const listed = (page: Page) =>
	expect(content(page).getByRole('link', { name: 'TitleFrame', exact: true })).toBeVisible();
const active = async (page: Page, name: string) => {
	const trigger = nav(page).getByRole('link', { name: 'Modules', exact: true });
	await expect(trigger).toHaveAttribute('aria-current', 'page');
	await expect(
		page.getByRole('tablist', { name: 'Module categories' }).getByRole('tab', { name, exact: true })
	).toHaveAttribute('aria-selected', 'true');
};

/**
 * How Shells is reached in the synthetic history: the title frame its manifest declares a shell,
 * at the tip of its branch, at a selected commit and at a commit no branch keeps; an old
 * Components address of it; and the commit where it was still recorded as a component.
 */
export const shellStates: Record<string, (page: Page) => Promise<void>> = {
	async shells(page) {
		await page.goto(at(shellsBranch, commits.shelled, 'layouts'));
		await titled(page, 'Layouts');
		await listed(page);
	},
	async 'shells-tip'(page) {
		await page.goto(tip(shellsBranch, 'layouts'));
		await titled(page, 'Layouts');
		await listed(page);
	},
	// Its overview, what it uses and that nothing uses it yet.
	async shell(page) {
		await page.goto(at(shellsBranch, commits.shelled, `shells/${unit}`));
		await titled(page, 'TitleFrame');
		await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page.getByRole('tab', { name: 'Uses', exact: true })).toBeVisible();
		await expect(content(page).getByRole('region', { name: 'Uses', exact: true })).toHaveCount(0);
	},
	async 'shell-details'(page) {
		await page.goto(at(shellsBranch, commits.shelled, `shells/${unit}/details`));
		await expect(
			content(page).getByRole('heading', { name: 'Contract', exact: true })
		).toBeVisible();
	},
	async 'shell-history'(page) {
		await page.goto(at(shellsBranch, commits.shelled, `shells/${unit}/history`));
		await titled(page, 'TitleFrame');
	},
	// The address of a component leads a shell to Shells, with its branch, commit, section and tab.
	async 'shell-redirect'(page) {
		await page.goto(at(shellsBranch, commits.shelled, `components/${unit}/details?tab=source`));
		await expectPath(page, at(shellsBranch, commits.shelled, `shells/${unit}?tab=source`));
		await expect(content(page).getByText('src/components/TitleFrame.svelte').first()).toBeVisible();
		await active(page, 'Layouts');
	},
	// Where its own manifest still recorded a component, it stays a component.
	async 'shell-earlier'(page) {
		const earlier = at(shellsBranch, commits.framed, `components/${unit}`);
		await page.goto(earlier);
		await titled(page, 'TitleFrame');
		await expectPath(page, earlier);
		await active(page, 'Components');
	},
	// A commit no branch keeps: its address has no branch, and none is invented.
	async 'shell-retained'(page) {
		await page.goto(`/harness/commit/${commits.shellRetained}/layouts/${unit}/history`);
		await titled(page, 'TitleFrame');
		await active(page, 'Layouts');
	}
};
