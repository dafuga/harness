import { expect, test, type Page } from '../../../../test/support/browserTest';
import { fakeProject } from './ui-workspace-fixture';

/**
 * The entity view at a phone width: a quiet back link to the category, one row of section tabs
 * that ends in the Conversation icon button, and a planned page's empty evidence in one line.
 */
const phone = { width: 390, height: 844 };

async function openPlannedPage(page: Page) {
	await page.setViewportSize(phone);
	await fakeProject(page);
	await page.goto('/');
	await page.getByRole('button', { name: 'Open project', exact: true }).click();
	await page.getByRole('link', { name: 'Open Activity' }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'Activity' })).toBeVisible();
}

test('the entity back link is a 44px link to its category', async ({ page }) => {
	await openPlannedPage(page);
	const back = page.getByRole('link', { name: /^‹ pages$/i });
	await expect(back).toBeVisible();
	// The label is capitalised on screen, as the section row's names are.
	await expect(back.evaluate((link) => (link as HTMLElement).innerText)).resolves.toBe('‹ Pages');
	expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44);
	await expect(back).toHaveAttribute('href', /\/harness\/branch\/feat%2Factivity\/pages$/);
});

test('the section tabs and Conversation share one phone row without page overflow', async ({
	page
}) => {
	await openPlannedPage(page);
	const tabs = page.getByRole('navigation', { name: 'Entity sections' });
	const buttons = tabs.getByRole('button');
	const conversation = tabs.getByRole('button', { name: 'Conversation', exact: true });
	await expect(conversation).toBeVisible();
	const tops = await buttons.evaluateAll((items) =>
		items.map((item) => Math.round(item.getBoundingClientRect().top))
	);
	expect(new Set(tops).size).toBe(1);
	const last = await buttons.evaluateAll((items) => items.at(-1)!.getAttribute('aria-label'));
	expect(last).toBe('Conversation');
	const sideways = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
	expect(sideways).toBeLessThanOrEqual(0);
});

test('an empty runtime evidence card on the overview is one line tall', async ({ page }) => {
	await openPlannedPage(page);
	await page
		.getByRole('navigation', { name: 'Entity sections' })
		.getByRole('button', {
			name: 'Overview',
			exact: true
		})
		.click();
	const card = page.getByRole('region', { name: 'Recorded runtime evidence' });
	await expect(card).toContainText('nothing is recorded for it');
	expect((await card.boundingBox())!.height).toBeLessThanOrEqual(120);
});
