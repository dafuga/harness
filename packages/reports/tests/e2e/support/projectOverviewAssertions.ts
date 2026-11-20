import { expect, type Page } from '@playwright/test';

/** The headline, totals and machine list of a ready snapshot. */
export async function expectReadyHeader(page: Page): Promise<void> {
	await expect(
		page.getByRole('heading', { level: 1, name: '1 project is waiting on you' })
	).toBeVisible();
	await expect(page.locator('.po-totals')).toHaveText('5 projects · 3 live sessions');
	await expect(page.getByRole('list', { name: 'Computers' }).getByRole('listitem')).toHaveCount(3);
}

/** Each state shows its own label, and every card is named by its project. */
export async function expectEveryStateShown(page: Page): Promise<void> {
	for (const name of ['Atlas', 'Beacon', 'Cinder', 'Delta', 'Ember']) {
		await expect(page.getByRole('article', { name, exact: true })).toBeVisible();
	}
	for (const label of ['Needs you', 'Blocked', 'Active', 'Quiet', 'Done']) {
		await expect(page.locator('.po-card .po-state', { hasText: label }).first()).toBeVisible();
	}
}

/** The Atlas callout and the Beacon blocked callout each show their own item and text. */
export async function expectCallouts(page: Page): Promise<void> {
	const atlas = page.getByRole('article', { name: 'Atlas', exact: true });
	await expect(atlas.locator('.po-callout[data-kind="attention"]')).toContainText('Needs you');
	await expect(atlas.locator('.po-callout[data-kind="attention"]')).toContainText(
		'Should the export keep the old column names for existing readers?'
	);
	const beacon = page.getByRole('article', { name: 'Beacon', exact: true });
	await expect(beacon.locator('.po-callout[data-kind="blocked"]')).toContainText(
		'Waiting on a signing key from the platform team'
	);
}

/** ETA words follow the rule: Overdue, No ETA, or a due date. */
export async function expectEtaWords(page: Page): Promise<void> {
	const cinder = page.getByRole('article', { name: 'Cinder', exact: true });
	await expect(cinder.locator('.po-eta[data-tone="scheduled"]').first()).toHaveText(/^Due /);
	await expect(cinder.locator('.po-eta[data-tone="none"]').first()).toHaveText('No ETA');
	const atlas = page.getByRole('article', { name: 'Atlas', exact: true });
	await expect(atlas.locator('.po-eta[data-tone="overdue"]')).toHaveText('Overdue');
}

/** A chip selects its state; the cards outside that state leave the page. */
export async function expectFilter(page: Page, label: string, visible: string[]): Promise<void> {
	await page.getByRole('button', { name: new RegExp(`^${label} `) }).click();
	await expect(page.getByRole('button', { name: new RegExp(`^${label} `) })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(page.getByRole('article')).toHaveCount(visible.length);
	for (const name of visible) {
		await expect(page.getByRole('article', { name, exact: true })).toBeVisible();
	}
}

/** Opening an item shows its read-only details; Escape closes it and returns focus to its opener. */
export async function expectDetailRoundTrip(page: Page): Promise<void> {
	const opener = page
		.getByRole('article', { name: 'Atlas', exact: true })
		.locator('.po-callout[data-kind="attention"] .po-action');
	await opener.focus();
	await opener.press('Enter');
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText('Choose the export column names');
	await expect(dialog.locator('dt', { hasText: 'Project' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(opener).toBeFocused();
}

/** Phone targets for filters, item actions and open buttons measure at least 44 CSS pixels. */
export async function expectPhoneTargets(page: Page): Promise<void> {
	const heights = await page
		.locator('.po-chip, .po-action, .po-item-open')
		.evaluateAll((nodes) =>
			nodes
				.filter((node) => (node as HTMLElement).offsetParent !== null)
				.map((node) => node.getBoundingClientRect().height)
		);
	expect(heights.length).toBeGreaterThan(0);
	for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);
}

/** A phone shows the top in-progress item only; the extra items stay out of the layout. */
export async function expectPhoneTrimmed(page: Page): Promise<void> {
	const shown = await page
		.locator('.po-item[data-extra]')
		.evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).offsetParent !== null));
	expect(shown.length).toBeGreaterThan(0);
	expect(shown.every((visible) => !visible)).toBe(true);
}

/** Nothing scrolls sideways at any viewport. */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

/** Empty and unreachable tracker answers use their named statuses. */
export async function expectEmptyReady(page: Page): Promise<void> {
	await expect(page.getByRole('status')).toHaveText('No projects are in the tracker yet.');
}

export async function expectUnavailable(page: Page): Promise<void> {
	await expect(page.getByRole('alert')).toContainText(
		'The tracker could not be reached from this host, so no projects are shown.'
	);
}

/** A filter that selects nothing says so rather than leaving a blank page. */
export async function expectNoMatch(page: Page): Promise<void> {
	await page.getByRole('button', { name: /^Done / }).click();
	await expect(page.getByRole('status')).toHaveText('No projects are in the Done state.');
}
