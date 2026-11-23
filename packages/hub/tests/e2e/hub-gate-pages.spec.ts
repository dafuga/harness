import { expect, test, type Locator, type Page } from '../../../../test/support/browserTest';
import { atlas, hostedFixture, invitation } from './hosted-fixture';
import { handoff } from './hosted-native';

/** The gate pages (invitation, device approval): one heading, a narrow card, a code field. */
const sizes = [
	{ id: 'phone', width: 390, height: 844 },
	{ id: 'tablet', width: 834, height: 1112 },
	{ id: 'laptop', width: 1440, height: 900 }
] as const;
const cardMaximum = 480;
const touchTarget = 44;
test.setTimeout(60_000);

async function box(locator: Locator) {
	const found = await locator.boundingBox();
	if (!found) throw new Error('The element has no layout box.');
	return found;
}

/** The page's own h1 is the only heading in the main column. */
async function oneHeading(page: Page, title: string) {
	const main = page.locator('.hub-main');
	await expect(main.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
	await expect(main.getByRole('heading')).toHaveCount(1);
}

/** The card is narrow and centred, and the field and its button are touch-sized. */
async function narrowCard(page: Page, field: Locator, action: Locator) {
	const card = await box(page.locator('.hub-card').filter({ has: field }));
	expect(card.width).toBeLessThanOrEqual(cardMaximum);
	const viewport = page.viewportSize()!;
	expect(Math.abs(card.x + card.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
	expect((await box(field)).height).toBeGreaterThanOrEqual(touchTarget);
	expect((await box(action)).height).toBeGreaterThanOrEqual(touchTarget);
}

/** The code field uses the same monospace face as the app's code text. */
async function monospaceField(field: Locator) {
	const faces = await field.evaluate((input) => {
		const probe = document.createElement('span');
		probe.style.fontFamily = 'var(--hx-font-family-code)';
		document.body.append(probe);
		const face = [getComputedStyle(input).fontFamily, getComputedStyle(probe).fontFamily];
		probe.remove();
		return face;
	});
	expect(faces[0]).toBe(faces[1]);
}

async function overflow(page: Page) {
	const extra = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(extra).toBe(0);
}

for (const size of sizes) {
	test(`the invitation page is one narrow gate at ${size.id}`, async ({ page }) => {
		await page.setViewportSize(size);
		await hostedFixture(page);
		await page.goto(`/invite/${atlas}/${invitation}`);
		await oneHeading(page, 'Join a shared project');
		const field = page.getByRole('textbox', { name: 'Invitation code', exact: true });
		const join = page.getByRole('button', { name: 'Join project', exact: true });
		await expect(field).toBeVisible();
		await expect(field).toHaveAttribute('autocomplete', 'one-time-code');
		await monospaceField(field);
		await narrowCard(page, field, join);
		await overflow(page);
	});

	test(`the device approval page is one narrow gate at ${size.id}`, async ({ page }) => {
		await page.setViewportSize(size);
		await hostedFixture(page);
		await page.goto(`/native/${handoff}`);
		await oneHeading(page, 'Connect a Harness device');
		const field = page.getByRole('textbox', {
			name: 'Code shown on your Harness device',
			exact: true
		});
		const approve = page.getByRole('button', { name: 'Approve this device', exact: true });
		await expect(field).toHaveAttribute('placeholder', 'ABCD-EFGH');
		await expect(field).toHaveAttribute('autocomplete', 'one-time-code');
		await monospaceField(field);
		await expect(page.getByText(/every shared project you can open, now and later/)).toBeVisible();
		await expect(page.getByText(/Never type a code\s+that someone sent you/)).toBeVisible();
		const roles = page.getByText(/writers\s+can\s+ask\s+agents\s+to\s+make\s+changes/);
		await expect(roles).toBeHidden();
		await page.getByText('What this allows', { exact: true }).click();
		await expect(roles).toBeVisible();
		await narrowCard(page, field, approve);
		await overflow(page);
	});
}
