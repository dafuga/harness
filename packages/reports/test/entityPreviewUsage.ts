import { reviewUsageCards } from './entityPreviewFunctions';
import { expect, type Page } from '@playwright/test';
import type { ExplorerLocation } from '../src/models/Explorer.types';
import { commits, ids } from './entityUnits';
import { capture, fits, open, ready, where } from './entityPreviewPage';

type UsageRoute = Pick<ExplorerLocation, 'category' | 'entity' | 'commit'>;

/** Usage belongs in its own tabs; pages expose dependencies and no consumers. */
export async function reviewUsage(page: Page, route: UsageRoute, viewport: string): Promise<void> {
	const { category, commit } = route;
	const checkpoint = `${category}-${commit ? 'commit' : 'tip'}-${viewport}`;
	await open(page, route);
	await ready(page);
	await capture(page, `overview-usage-${checkpoint}`);
	await expect(page.getByRole('region', { name: /^(Used In|Uses)$/ })).toHaveCount(0);
	if (category === 'pages') {
		await expect(page.getByRole('tab', { name: 'Used In', exact: true })).toHaveCount(0);
		await open(page, { ...route, tab: 'used-in' });
		await ready(page);
		await capture(page, `legacy-usage-${checkpoint}`);
		await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page.getByRole('tabpanel', { name: /overview$/ })).toBeVisible();
		await expect(page.getByRole('region', { name: 'Used In', exact: true })).toHaveCount(0);
		expect(await where(page)).toMatchObject(route);
	}
	for (const [label, tab] of [
		['Used In', 'used-in'],
		['Uses', 'uses']
	] as const) {
		if (category === 'pages' && tab === 'used-in') continue;
		await page.getByRole('tab', { name: label, exact: true }).click();
		await expect(page.getByRole('region', { name: label, exact: true })).toBeVisible();
		await capture(page, `usage-${tab}-${checkpoint}`);
		await expect(page.locator('.ex-relations .hx-verdict'), 'no row marks').toHaveCount(0);
		await reviewUsageCards(page, category, tab, commit);
		await expect(page.locator('.ex-head .hx-verdict')).toHaveCount(1);
		await expect(
			page.getByRole('region', { name: label === 'Uses' ? 'Used In' : 'Uses', exact: true })
		).toHaveCount(0);
		expect(await where(page)).toMatchObject({ ...route, tab });
	}
}

/** Every module group expands independently in full and partial batches at both revision modes. */
export async function reviewRelationPaging(page: Page, viewport: string): Promise<void> {
	for (const commit of [null, commits.middle]) {
		const route = {
			category: 'functions' as const,
			entity: ids.filter,
			commit,
			tab: 'used-in' as const
		};
		await open(page, route, 'relations');
		const pages = page.getByRole('group', { name: 'Pages used in', exact: true });
		const components = page.getByRole('group', { name: 'Components used in', exact: true });
		await capture(page, `relations-collapsed-${commit ? 'commit' : 'tip'}-${viewport}`);
		await expect(pages.getByRole('article'), 'four initial entries per type').toHaveCount(4);
		await expect(components.getByRole('article')).toHaveCount(4);
		const more = pages.getByRole('button', { name: 'View more Pages', exact: true });
		await more.click();
		await expect(pages.getByRole('article')).toHaveCount(8);
		await expect(pages.getByRole('article').nth(4).getByRole('link').first()).toBeFocused();
		await expect(components.getByRole('article'), 'other types stay collapsed').toHaveCount(4);
		await more.press('Enter');
		await expect(pages.getByRole('article')).toHaveCount(10);
		await expect(more).toHaveCount(0);
		await expect(pages.getByRole('article').nth(8).getByRole('link').first()).toBeFocused();
		await capture(page, `relations-expanded-${commit ? 'commit' : 'tip'}-${viewport}`);
		expect(await where(page)).toMatchObject(route);
		await page.getByRole('tab', { name: 'Uses', exact: true }).click();
		await page.getByRole('tab', { name: 'Used In', exact: true }).click();
		await expect(pages.getByRole('article'), 'returning to the tab resets batches').toHaveCount(4);
		await open(page, { category: 'pages', entity: ids.page, commit, tab: 'uses' }, 'relations');
		await expandTable(page, viewport, commit);
		expect(await fits(page)).toBe(true);
	}
}

async function expandTable(page: Page, viewport: string, commit: string | null): Promise<void> {
	const services = page.getByRole('group', { name: 'Services uses', exact: true });
	const rows = services.locator('tbody tr');
	const more = services.getByRole('button', { name: 'View more Services', exact: true });
	await expect(rows, 'table module types use the same four-entry batches').toHaveCount(4);
	await more.click();
	await expect(rows).toHaveCount(8);
	await more.press('Enter');
	await expect(rows).toHaveCount(9);
	await expect(more).toHaveCount(0);
	await expect(services.locator('tbody tr').nth(8).getByRole('link').first()).toBeFocused();
	await capture(page, `relations-table-${commit ? 'commit' : 'tip'}-${viewport}`);
	await expect(
		page.getByRole('group', { name: 'Components uses', exact: true }).getByRole('article')
	).toHaveCount(4);
}
