import { expect, type Page } from '@playwright/test';
import { at, explorer } from './explorer';
import { seeded } from './harnessHistory';

const { commits, keptBranch } = seeded();
const { explorerUnits: units } = explorer();
const titled = (page: Page, name: string) =>
	expect(page.getByRole('heading', { level: 1, name })).toBeVisible();

/**
 * How the remaining screens of the explorer are reached, so that every page of it has a capture
 * of its own: the catalogs, and the details and history of each kind of entity.
 */
export const screenStates: Record<string, (page: Page) => Promise<void>> = {
	async 'page-details'(page) {
		await page.goto(at('main', commits.approved, `pages/${units.page}/details`));
		await titled(page, 'Titles');
	},
	async 'page-history'(page) {
		await page.goto(at(keptBranch, commits.twin, `pages/${units.page}/history`));
		await titled(page, 'Titles');
	},
	async components(page) {
		await page.goto(at('main', commits.approved, 'components'));
		await titled(page, 'Components');
	},
	async 'component-details'(page) {
		await page.goto(at('main', commits.approved, `components/${units.list}/details`));
		await titled(page, 'TitleList');
	},
	async 'component-history'(page) {
		await page.goto(at('main', commits.approved, `components/${units.list}/history`));
		await titled(page, 'TitleList');
	},
	async configs(page) {
		await page.goto(at('main', commits.approved, 'configs'));
		await titled(page, 'Configs');
	},
	async 'config-details'(page) {
		await page.goto(at('main', commits.approved, `configs/${units.config}/details`));
		await titled(page, 'titlesConfig');
	},
	async 'config-history'(page) {
		await page.goto(at('main', commits.approved, `configs/${units.config}/history`));
		await titled(page, 'titlesConfig');
	},
	async services(page) {
		await page.goto(at('main', commits.approved, 'services'));
		await titled(page, 'Services');
	},
	async 'service-details'(page) {
		await page.goto(at('main', commits.approved, `services/${units.service}/details`));
		await titled(page, 'TitleService');
	},
	async 'service-history'(page) {
		await page.goto(at('main', commits.reordered, `services/${units.service}/history`));
		await titled(page, 'TitleService');
	},
	// A commit that no branch reaches: its address has no branch, and none is invented.
	async retained(page) {
		await page.goto(`/harness/commit/${commits.retained}/pages`);
		await titled(page, 'Pages');
	}
};
