import type { Page } from '../../../../test/support/browserTest';
import { at } from './ui-design-options-helpers';
import { designOptionsFixture } from './ui-design-options-fixture';

/** The sizes and the Project chat opener that the composer tests share. SYNTHETIC: no agent runs. */
export const tablet = { width: 834, height: 1112 };
export const laptop = { width: 1440, height: 900 };
export const phone = { width: 390, height: 844 };
export const pageRoute = 'pages/page%3Aactivity';
export const bubble = (page: Page) =>
	page.getByRole('button', { name: /^(Work with agent|Open project chat)$/ });
export const panel = (page: Page) => page.getByRole('complementary', { name: 'Project agent' });

export async function openProjectChat(page: Page, size: typeof laptop, seeded = true) {
	await page.setViewportSize(size);
	if (seeded) await designOptionsFixture(page);
	await page.goto(at(pageRoute));
	// A laptop opens an entity with its design conversation; that panel closes first.
	if (size.width > 850)
		await page.getByRole('button', { name: 'Close conversation', exact: true }).click();
	await bubble(page).click();
}
