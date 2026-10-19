import { expect, type Page } from '@playwright/test';
import { shellsBranch } from '../../../scripts/harness-shells-seed';
import { at, tip } from './explorer';
import { seeded, short } from './harnessHistory';

const { commits } = seeded();
const field = (page: Page) =>
	page.getByRole('banner').getByRole('combobox', { name: 'Search entities', exact: true });
const found = (page: Page) =>
	page.getByRole('listbox', { name: 'Entities found', exact: true }).getByRole('option');

/**
 * How the search of the bar is reached in the synthetic history: the entities the console read for
 * the revision in view, at a branch tip that holds a shell and at a selected commit that does not.
 */
export const searchStates: Record<string, (page: Page) => Promise<void>> = {
	async 'catalog-filters'(page) {
		await page.goto(at('main', commits.approved, 'pages'));
		await page.getByRole('button', { name: 'Filters', exact: true }).click();
		const dialog = page.getByRole('dialog', { name: 'Filters', exact: true });
		await expect(dialog).toBeVisible();
		expect(await dialog.evaluate((node) => node.getBoundingClientRect().height)).toBeLessThan(650);
	},
	async search(page) {
		await page.goto(tip(shellsBranch, 'shells'));
		await page.getByRole('button', { name: 'Search entities', exact: true }).click();
		await field(page).fill('title');
		await expect(found(page).filter({ hasText: 'Title frame' })).toContainText('Shell');
		await expect(found(page).first()).toHaveAttribute('aria-selected', 'true');
	},
	async 'search-pinned'(page) {
		await page.goto(at('main', commits.approved, 'functions'));
		await page.getByRole('button', { name: 'Search entities', exact: true }).click();
		await expect(field(page)).toHaveAttribute(
			'placeholder',
			`Search at ${short(commits.approved)}`
		);
		await field(page).fill('title');
		await expect(found(page).first()).toBeVisible();
		await expect(found(page).filter({ hasText: 'Title frame' })).toHaveCount(0);
	}
};
