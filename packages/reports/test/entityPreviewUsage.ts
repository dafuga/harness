import { expect, type Page } from '@playwright/test';
import type { ExplorerLocation } from '../src/models/Explorer.types';
import { capture, open, ready, where } from './entityPreviewPage';

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
		await expect(page.locator('.ex-related .hx-verdict'), 'no row marks').toHaveCount(0);
		await expect(page.locator('.ex-head .hx-verdict')).toHaveCount(1);
		await expect(
			page.getByRole('region', { name: label === 'Uses' ? 'Used In' : 'Uses', exact: true })
		).toHaveCount(0);
		expect(await where(page)).toMatchObject({ ...route, tab });
	}
}
