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
		await expandUsageGroups(page, viewport, commit);
		expect(await fits(page)).toBe(true);
	}
}

async function expandUsageGroups(
	page: Page,
	viewport: string,
	commit: string | null
): Promise<void> {
	for (const kind of ['Services', 'Models']) {
		const group = page.getByRole('group', { name: `${kind} uses`, exact: true });
		const items = kind === 'Services' ? group.getByRole('article') : group.locator('tbody tr');
		const more = group.getByRole('button', { name: `View more ${kind}`, exact: true });
		await capture(
			page,
			`relations-${kind.toLowerCase()}-initial-${commit ? 'commit' : 'tip'}-${viewport}`
		);
		await expect(items, 'card and table groups use four-entry batches').toHaveCount(4);
		await more.click();
		await expect(items).toHaveCount(8);
		await more.press('Enter');
		await expect(items).toHaveCount(9);
		await expect(more).toHaveCount(0);
		await expect(items.nth(8).getByRole('link').first()).toBeFocused();
		await capture(page, `relations-${kind.toLowerCase()}-${commit ? 'commit' : 'tip'}-${viewport}`);
		await expect(
			page.getByRole('group', { name: 'Components uses', exact: true }).getByRole('article')
		).toHaveCount(4);
	}
}

/** Usage tabs use the same cards as their collections without widening the page. */
export async function reviewUsageCards(
	page: Page,
	category: string,
	direction: string,
	commit: string | null = commits.middle
): Promise<void> {
	await reviewConsumerKinds(page, category, direction);
	const cards = page.locator('.ex-relations article');
	for (const card of await cards.all()) {
		await expect(card).toHaveAttribute('data-harness-component', 'explorer-module-card');
		await expect(
			card.getByRole('group', { name: 'Used In', exact: true }),
			'every relationship card includes its usage footer'
		).toBeVisible();
	}
	if (category === 'components' && direction === 'uses') {
		const card = page.getByRole('article', { name: 'OrderCard', exact: true });
		await expect(
			card
				.getByRole('group', { name: 'Used In', exact: true })
				.getByRole('link', { name: 'OrderList', exact: true })
		).toHaveAttribute(
			'href',
			`/harness/branch/feature%2Forders${commit ? `/commit/${commit}` : ''}/components/${ids.list}`
		);
	}
	if (category === 'pages' && direction === 'uses')
		await expect(
			page.getByRole('region', { name: 'Uses', exact: true }).locator('article.ex-page-card'),
			'Relationships reuse catalog cards'
		).toHaveCount(2);
	expect(await fits(page)).toBe(true);
}

/** Reverse dependencies name every populated module type. */
async function reviewConsumerKinds(page: Page, category: string, direction: string): Promise<void> {
	if (category === 'components' && direction === 'uses') {
		for (const kind of ['Functions', 'Services']) {
			const group = page.getByRole('group', { name: `${kind} uses`, exact: true });
			await expect(
				group.locator('.ex-function-tile'),
				'each module group has its own card'
			).toHaveCount(1);
		}
	}
	if (direction !== 'used-in' || category !== 'functions') return;
	const used = page.getByRole('region', { name: 'Used In', exact: true });
	for (const kind of ['Pages', 'Components'])
		await expect(used.getByRole('heading', { name: `${kind} 1`, exact: true })).toBeVisible();
}

/** Service cards keep only a recorded name and usage, with navigation in the viewed revision. */
export async function reviewServiceCard(page: Page, viewport: string): Promise<void> {
	for (const commit of [null, commits.middle]) {
		await open(page, { category: 'services', commit }, 'helpers');
		await page.evaluate(async () => {
			await document.fonts.ready;
		});
		await capture(page, `service-card-${commit ? 'commit' : 'tip'}-${viewport}`);
		const card = page.getByRole('article', { name: 'OrderStore', exact: true });
		await expect(
			page.getByRole('article'),
			'only instantiated shared classes with multiple methods are services'
		).toHaveCount(1);
		await expect(card, 'service cards show only name and usage').toHaveText(
			/^\s*OrderStore\s*Used In\s*OrderList\s*SearchBox\s*$/
		);
		await expect(card.locator('h2, p, img, button, svg, .hx-verdict')).toHaveCount(0);
		const usage = card.getByRole('group', { name: 'Used In', exact: true });
		await expect(usage.getByRole('link')).toHaveText(['OrderList', 'SearchBox']);
		for (const search of ['OrderStore', 'OrderStore']) {
			await page.getByRole('searchbox', { name: 'Search services' }).fill(search);
			await expect(card).toHaveCount(1);
		}
		expect(await fits(page)).toBe(true);
		await card.getByRole('link', { name: 'OrderStore', exact: true }).press('Enter');
		expect(await where(page)).toMatchObject({
			branch: 'feature/orders',
			category: 'services',
			entity: ids.store,
			commit
		});
		await expect(page.getByRole('heading', { name: 'OrderStore', exact: true })).toBeVisible();
		await open(page, { category: 'services', commit }, 'helpers');
		await card
			.getByRole('group', { name: 'Used In', exact: true })
			.getByRole('link', { name: 'OrderList', exact: true })
			.press('Enter');
		expect(await where(page)).toMatchObject({
			branch: 'feature/orders',
			category: 'components',
			entity: ids.list,
			commit
		});
		await reviewFunctionService(page, commit);
	}
}
/** Shared effectful functions retain their actual code identity outside the class catalog. */
async function reviewFunctionService(page: Page, commit: string | null) {
	await open(page, { category: 'services', commit }, 'helpers');
	await expect(page.getByRole('article', { name: 'recordAnalytics', exact: true })).toHaveCount(0);
	await open(
		page,
		{ category: 'services', entity: 'app.workflow.record-analytics', commit },
		'helpers'
	);
	await expect(page.getByRole('heading', { name: 'recordAnalytics', exact: true })).toBeVisible();
	expect(await where(page)).toMatchObject({ commit, entity: 'app.workflow.record-analytics' });
}
