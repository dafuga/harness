import { expect, type Page } from '@playwright/test';
import { seeded } from './harnessHistory';

const kept = '/harness/branch/feature/kept%231';
const unit = 'function.packer';
const budgets = (page: Page) =>
	page
		.getByRole('region', { name: 'Component details' })
		.getByRole('group', { name: 'Budgets and measurements' });

/**
 * The states that show the size of what a unit emits: its panel after both sizes were approved,
 * its panel at the commit that no longer builds one output, and its growth target by target.
 */
export const emittedStates: Record<string, (page: Page) => Promise<void>> = {
	// What the history recorded of the project's work; live activity is said not to be in it.
	async activity(page) {
		await page.goto(`/harness/branch/main/commit/${seeded().commits.sourceOnly}/activity`);
		const work = page.getByRole('region', { name: 'Recent work', exact: true });
		await expect(work.getByRole('list', { name: 'Recent commits' })).toBeVisible();
		await expect(page.getByRole('region', { name: 'Working agents', exact: true })).toContainText(
			'not part of a recorded history'
		);
	},
	// Before any review: everything is measured, a freeze is declared, and no limit is claimed.
	async unreviewed(page) {
		await page.goto(`${kept}/commit/${seeded().commits.emitting}/map/unit/${unit}`);
		await expect(budgets(page)).toContainText('source-bytes: 95 bytes · freeze declared');
		await expect(budgets(page)).toContainText('no reviewed limit is recorded at this revision');
		await budgets(page).scrollIntoViewIfNeeded();
	},
	async emitted(page) {
		await page.goto(`${kept}/commit/${seeded().commits.repacked}/map/unit/${unit}`);
		await expect(budgets(page)).toContainText('emitted size (process (native)): 7 bytes');
		await expect(budgets(page)).toContainText('emitted size (Wasm): 1 byte · frozen at 1 byte');
		await budgets(page).scrollIntoViewIfNeeded();
	},
	async 'emitted-gone'(page) {
		await page.goto(`${kept}/commit/${seeded().commits.vanished}/map/unit/${unit}`);
		await expect(budgets(page)).toContainText('emitted size (Wasm): unavailable');
		await expect(budgets(page)).toContainText('can no longer be measured');
		await budgets(page).scrollIntoViewIfNeeded();
	},
	async 'emitted-growth'(page) {
		await page.goto(`${kept}/commit/${seeded().commits.vanished}/growth/unit/${unit}`);
		const table = page.getByRole('table', { name: `Emitted sizes of ${unit}` });
		await expect(table).toContainText('Approved by Reviewer One: process (native) 3 → 7');
		await expect(table).toContainText('Packs in upper case');
		await page.getByRole('region', { name: `Emitted sizes of ${unit}` }).scrollIntoViewIfNeeded();
	}
};
