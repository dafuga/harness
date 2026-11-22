import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { PlatformSearchCase } from '../tests/e2e/support/component-previews/platformSearchVideo.types';
import { capture } from './entityPreviewPage';

/** The Orders platforms in the bit order the finite search fixtures use: bit n selects platform n. */
const platforms = ['Web', 'iOS', 'Android', 'Desktop (Electron)'];
const statusCases: [string, string[]][] = [
	['all', platforms],
	['configured', ['Web', 'Desktop (Electron)']],
	['setup-required', ['iOS']],
	['not-configured', ['Android']],
	['not-recorded', []]
];

/** Every fixture search-N.json, read from the same files the recorded search video uses. */
function searchCases(): PlatformSearchCase[] {
	return Array.from({ length: 16 }, (_, mask) => {
		const file = new URL(
			`../tests/e2e/support/component-previews/video-fixtures/search-${mask}.json`,
			import.meta.url
		);
		return JSON.parse(readFileSync(file, 'utf8')) as PlatformSearchCase;
	});
}

const expectedFor = (mask: number) => platforms.filter((_, bit) => (mask & (1 << bit)) !== 0);
const links = (page: Page) => page.getByRole('link', { name: /^View .+ configuration$/ });
const search = (page: Page) =>
	page.getByRole('searchbox', { name: 'Search platforms', exact: true });
const trigger = (page: Page) => page.getByRole('button', { name: 'Filters', exact: true });
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Filters', exact: true });
const done = (page: Page) => dialog(page).getByRole('button', { name: 'Done', exact: true });

/** Exact card set: the count matches and every expected link is present once, so nothing extra shows. */
async function expectPlatforms(page: Page, names: string[]): Promise<void> {
	await expect(links(page)).toHaveCount(names.length);
	for (const name of names) {
		const link = page.getByRole('link', { name: `View ${name} configuration`, exact: true });
		await expect(link).toHaveCount(1);
	}
	const shown = `${names.length} of ${platforms.length} platforms shown`;
	await expect(page.getByText(shown, { exact: true })).toHaveCount(1);
	if (!names.length) {
		await expect(page.getByText('No platforms match this search or filter.')).toBeVisible();
	}
}

async function showAll(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'Show all platforms', exact: true }).click();
}

/** Sets one status in the Filters dialog, then closes it so the list behind can be read. */
async function chooseStatus(page: Page, status: string): Promise<void> {
	await trigger(page).click();
	await dialog(page).getByRole('combobox').selectOption(status);
	await done(page).click();
}

/** Keyboard focus moves between Search and Filters and persists during pointer hover. */
async function focusAndHover(page: Page): Promise<void> {
	await search(page).focus();
	await page.keyboard.press('Tab');
	await expect(trigger(page)).toBeFocused();
	await page.keyboard.press('Shift+Tab');
	await expect(search(page)).toBeFocused();
	const web = page.getByRole('link', { name: 'View Web configuration', exact: true });
	await web.hover();
	expect(await web.evaluate((node) => node.matches(':hover'))).toBe(true);
	await expect(search(page)).toBeFocused();
	await expectPlatforms(page, platforms);
}

/** Each fixture query yields its exact set; each class is reset before the next one starts. */
async function exerciseSearchCases(page: Page, viewport: string): Promise<void> {
	for (const [index, fixture] of searchCases().entries()) {
		expect(fixture.mask, `search-${index}.json names its own mask`).toBe(index);
		await search(page).fill(fixture.query);
		await expectPlatforms(page, expectedFor(fixture.mask));
		if (fixture.mask === 0) {
			await capture(page, `platforms-search-no-results-${viewport}`);
			await showAll(page);
		} else {
			await search(page).fill('');
		}
		await expectPlatforms(page, platforms);
	}
}

/** Every status option yields its exact set; the not-recorded zero result resets with Show all. */
async function exerciseStatusCases(page: Page): Promise<void> {
	for (const [status, names] of statusCases) {
		await chooseStatus(page, status);
		await expectPlatforms(page, names);
		if (status === 'not-recorded') await showAll(page);
	}
	await expectPlatforms(page, platforms);
}

/**
 * The native status picker closes on Escape and keeps its applied value. Headless Chromium may
 * report the Escape either to the picker or to the dialog, so the dialog is closed only if open.
 */
async function exercisePickerEscape(page: Page): Promise<void> {
	await trigger(page).click();
	const select = dialog(page).getByRole('combobox');
	await select.selectOption('configured');
	await select.click();
	await expect.poll(() => select.evaluate((node) => node.matches(':open'))).toBe(true);
	await page.keyboard.press('Escape');
	if (await dialog(page).isVisible()) {
		await expect.poll(() => select.evaluate((node) => node.matches(':open'))).toBe(false);
		await done(page).click();
	}
	await expect(trigger(page)).toHaveAttribute('title', 'Filters · 1 active');
	await expectPlatforms(page, ['Web', 'Desktop (Electron)']);
	await trigger(page).click();
	await expect(dialog(page).getByRole('combobox')).toHaveValue('configured');
	await done(page).click();
}

/** A matching query narrows the filtered set. Reset filters preserves the query. */
async function exerciseMatchingAndReset(page: Page): Promise<void> {
	await search(page).fill('electron');
	await expectPlatforms(page, ['Desktop (Electron)']);
	await trigger(page).click();
	await dialog(page).getByRole('button', { name: 'Reset filters', exact: true }).click();
	await done(page).click();
	await expect(trigger(page)).toHaveAttribute('title', 'Filters');
	await expectPlatforms(page, ['Desktop (Electron)']);
}

/** A disjoint query and filter give no card, and the zero-result Show all action resets both. */
async function exerciseDisjointAndReset(page: Page, viewport: string): Promise<void> {
	await chooseStatus(page, 'setup-required');
	await expectPlatforms(page, []);
	await capture(page, `platforms-filter-no-results-${viewport}`);
	await showAll(page);
	await expect(search(page)).toHaveValue('');
	await expectPlatforms(page, platforms);
}

/**
 * Covers every finite search result and the status and query intersections on the ready
 * Platforms route. The caller opens the route; this resets to the full list when it ends.
 */
export async function exercisePlatformFilters(page: Page, viewport: string): Promise<void> {
	await expectPlatforms(page, platforms);
	await focusAndHover(page);
	await exerciseSearchCases(page, viewport);
	await exerciseStatusCases(page);
	await exercisePickerEscape(page);
	await exerciseMatchingAndReset(page);
	await exerciseDisjointAndReset(page, viewport);
}
