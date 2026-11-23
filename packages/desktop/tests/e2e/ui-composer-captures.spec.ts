import { fileURLToPath } from 'node:url';
import { expect, test } from '../../../../test/support/browserTest';
import { activity, at, option } from './ui-design-options-helpers';
import { laptop, openProjectChat, panel, phone, tablet } from './ui-composer-fixture';

/**
 * Fresh captures of the changed screens, written to the design record. Opt-in: TAKE_SCREENSHOT=true.
 */
const screens = fileURLToPath(
	new URL('../../../../specification/designs/full-pass/screens/', import.meta.url)
);
for (const [name, size, scale] of [
	['phone', phone, 2],
	['tablet', tablet, 1],
	['laptop', laptop, 1]
] as const) {
	test.describe(`captures at ${name}`, () => {
		test.skip(process.env.TAKE_SCREENSHOT !== 'true', 'Screenshots are opt-in.');
		test.use({ viewport: size, deviceScaleFactor: scale });
		test(`agent panel and designs at ${name}`, async ({ page }) => {
			await openProjectChat(page, size);
			await expect(
				panel(page).getByRole('heading', { name: 'Project chat', exact: true })
			).toBeVisible();
			await page.mouse.move(0, 0);
			await page.screenshot({ path: `${screens}after--agent-panel--${name}.png` });
			await page.getByRole('button', { name: 'Close chat', exact: true }).click();
			await page.goto(at(activity));
			await option(page, 2).click();
			await page.mouse.move(0, 0);
			await page.screenshot({ path: `${screens}after--entity-designs--${name}.png` });
		});
	});
}
