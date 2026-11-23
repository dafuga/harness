import { expect, test, type Locator, type Page } from '../../../../test/support/browserTest';
import { designOptionsFixture } from './ui-design-options-fixture';
import { activity, at, option } from './ui-design-options-helpers';
import { alpha, remotePhoneFixture } from './ui-remote-phone-fixture';

/**
 * The floating project-agent button never covers the design conversation's controls or the last
 * card of a page: it is hidden while the conversation or the agent panel is open, and a page
 * leaves room for it at the bottom. SYNTHETIC fixture: no agent runs.
 */
const laptop = { width: 1440, height: 900 };
const phone = { width: 390, height: 844 };
const pageRoute = 'pages/page%3Aactivity';

type Box = { x: number; y: number; width: number; height: number };

const bubble = (page: Page) =>
	page.getByRole('button', { name: /^(Work with agent|Open project chat)$/ });

function intersects(a: Box | null, b: Box | null) {
	if (!a || !b) return false;
	return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

// The page scrolls with the wheel, as a person does; a script jump to the end is not taken here.
async function scrollToEnd(page: Page) {
	await page.mouse.move(200, 400);
	await expect(async () => {
		await page.mouse.wheel(0, 1000);
		const atEnd = await page.evaluate(
			() => Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight
		);
		expect(atEnd).toBe(true);
	}).toPass();
}

async function expectClear(page: Page, target: Locator) {
	await expect(target).toBeVisible();
	// A hidden button has no box to clear; its absence is the rule being tested.
	const floating = (await bubble(page).isVisible()) ? await bubble(page).boundingBox() : null;
	expect(intersects(floating, await target.boundingBox())).toBe(false);
}

async function openDesignConversation(page: Page, size: typeof laptop) {
	await page.setViewportSize(size);
	await designOptionsFixture(page);
	await page.goto(at(activity));
	await option(page, 2).click();
	if (size.width <= 850) {
		await page
			.getByRole('navigation', { name: 'Entity sections' })
			.getByRole('button', { name: 'Conversation', exact: true })
			.click();
	}
	await expect(page.getByRole('button', { name: 'Approve v003', exact: true })).toBeVisible();
}

for (const [label, size] of [
	['1440', laptop],
	['390', phone]
] as const) {
	test(`with the design conversation open at ${label}, the floating button is hidden and the controls stay clear`, async ({
		page
	}) => {
		await openDesignConversation(page, size);
		await expect(bubble(page)).toBeHidden();
		const thread = page.locator('.thread-panel');
		await expectClear(page, thread.getByRole('button', { name: 'Approve v003', exact: true }));
		await scrollToEnd(page);
		await expect(thread.getByRole('button', { name: /^Send / }).first()).toBeVisible();
		await expectClear(page, thread.getByRole('button', { name: /^Send / }).first());
	});
}

test('on the paired iPhone workspace at 390, the floating button clears the footer Disconnect', async ({
	page
}) => {
	await page.setViewportSize(phone);
	await remotePhoneFixture(page, 'online');
	await page.goto(`/projects/${alpha}/harness/branch/feat%2Falpha/${pageRoute}`);
	await expect(page.getByRole('heading', { level: 1, name: 'Alpha activity' })).toBeVisible();
	await expect(bubble(page)).toBeVisible();
	await scrollToEnd(page);
	await expectClear(page, page.getByRole('button', { name: 'Disconnect', exact: true }));
});

test('at 390, the page keeps its last card clear of the floating button', async ({ page }) => {
	await page.setViewportSize(phone);
	await designOptionsFixture(page);
	await page.goto(at(pageRoute));
	const last = page.getByRole('region', { name: 'Recorded runtime evidence' });
	await expect(bubble(page)).toBeVisible();
	await scrollToEnd(page);
	await expectClear(page, last);
});

for (const [label, size] of [
	['1440', laptop],
	['390', phone]
] as const) {
	test(`the agent panel at ${label} hides the floating button and its own close brings it back`, async ({
		page
	}) => {
		await page.setViewportSize(size);
		await designOptionsFixture(page);
		await page.goto(at(pageRoute));
		// A laptop opens an entity with its design conversation; that panel closes first.
		if (size.width > 850)
			await page.getByRole('button', { name: 'Close conversation', exact: true }).click();
		await bubble(page).click();
		await expect(page.getByRole('button', { name: 'Close chat', exact: true })).toBeVisible();
		await expect(bubble(page)).toBeHidden();
		await page.getByRole('button', { name: 'Close chat', exact: true }).click();
		await expect(bubble(page)).toBeVisible();
	});
}
