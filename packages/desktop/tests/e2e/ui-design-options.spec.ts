import { expect, test, type Page } from '@playwright/test';
import { designOptionsFixture, imageSha, options } from './ui-design-options-fixture';
import {
	activity,
	at,
	calls,
	count,
	modes,
	option,
	optionGroup,
	remember,
	shows
} from './ui-design-options-helpers';

/**
 * A Plan of a page, shell or component asks for a number of design options: three unless the
 * person chooses another on Settings, for a thread and the project agent alike. A
 * comment, a Change and a headless plan have no such choice, and one legacy design offers none.
 * SYNTHETIC fixture: no image is generated and no agent runs.
 */
async function planIn(page: Page, selected?: string) {
	await designOptionsFixture(page);
	await page.goto(`/settings?from=${encodeURIComponent(at(activity))}`);
	await expect(count(page)).toHaveValue('3');
	if (selected) await count(page).selectOption(selected);
	await page.goto(at(activity));
	await modes(page).getByRole('button', { name: 'Plan', exact: true }).click();
	await expect(count(page)).toHaveCount(0);
}
async function sentRun(page: Page) {
	await expect.poll(async () => (await calls(page, 'startRun')).length).toBe(1);
	return (await calls(page, 'startRun'))[0];
}

test('an entity Plan offers three design options and sends the count that was chosen', async ({
	page
}, info) => {
	await planIn(page, '2');
	await remember(page, info, 'thread-count');
	await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Two directions, please');
	await page.getByRole('button', { name: 'Send plan', exact: true }).click();
	expect(await sentRun(page)).toMatchObject({ mode: 'plan', designOptions: 2 });
});

test('an entity Plan that keeps the default asks for three design options', async ({
	page
}, info) => {
	await planIn(page);
	await remember(page, info, 'thread-default');
	await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Show me directions');
	await page.getByRole('button', { name: 'Send plan', exact: true }).click();
	expect(await sentRun(page)).toMatchObject({ mode: 'plan', designOptions: 3 });
});

test('a comment offers no design option count', async ({ page }, info) => {
	await planIn(page);
	await modes(page).getByRole('button', { name: 'Comment', exact: true }).click();
	await expect(count(page)).toHaveCount(0);
	await remember(page, info, 'comment-count');
});

test('the project agent sends the count chosen with its creation request', async ({
	page
}, info) => {
	await designOptionsFixture(page);
	await page.goto(`/settings?from=${encodeURIComponent(at('pages'))}`);
	await expect(count(page)).toHaveValue('3');
	await count(page).selectOption('2');
	await page.goto(at('pages'));
	await page.getByRole('button', { name: 'Work with agent', exact: true }).click();
	const agent = page.getByRole('complementary', { name: 'Project agent', exact: true });
	await expect(count(agent)).toHaveCount(0);
	await remember(page, info, 'creation-count');
	await agent.getByRole('textbox', { name: 'Message', exact: true }).fill('Add a refunds page');
	await agent.getByRole('button', { name: 'Send plan', exact: true }).click();
	const sent = await sentRun(page);
	expect(sent).toMatchObject({ intent: 'create', mode: 'plan', designOptions: 2 });
	expect(sent.text).toBe('Add a refunds page');
});

test('a headless function plans notes and cases with no design option count', async ({
	page
}, info) => {
	await designOptionsFixture(page);
	await page.goto(at('functions/function%3Aformat-time/designs'));
	await modes(page).getByRole('button', { name: 'Plan', exact: true }).click();
	await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeVisible();
	await expect(count(page)).toHaveCount(0);
	await expect(optionGroup(page)).toHaveCount(0);
	await remember(page, info, 'headless-count');
});

test('a legacy single design is shown as it was recorded, with no alternatives', async ({
	page
}, info) => {
	await designOptionsFixture(page);
	await page.goto(at('components/component%3Abutton/designs'));
	await expect(page.getByRole('img', { name: /\bv001\b/ }).first()).toBeVisible();
	await expect(optionGroup(page)).toHaveCount(0);
	const read = (await calls(page, 'image')).map((call) => call.sha256);
	expect(read).toContain(imageSha);
	expect(read.filter((hash) => options.some((item) => item.sha256 === hash))).toEqual([]);
	await remember(page, info, 'legacy');
});

for (const viewport of [
	{ id: 'desktop', width: 1440, height: 900 },
	{ id: 'tablet', width: 768, height: 1024 },
	{ id: 'phone', width: 390, height: 844 }
]) {
	test(`${viewport.id}: the options fit and are switched with the keyboard`, async ({
		page
	}, info) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await designOptionsFixture(page);
		await page.goto(at(activity));
		await expect(page.getByRole('img', { name: /\bv003\b/ }).first()).toBeVisible();
		await expect(option(page, 1)).toHaveAttribute('aria-pressed', 'true');
		const box = (await optionGroup(page).boundingBox())!;
		expect(box.x >= 0 && box.x + box.width <= viewport.width).toBe(true);
		await option(page, 1).focus();
		await page.keyboard.press('Tab');
		await expect(option(page, 2)).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(option(page, 2)).toHaveAttribute('aria-pressed', 'true');
		await shows(page, 'o2');
		const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
		expect(fits).toBe(true);
		await remember(page, info, `fit-${viewport.id}`);
	});
}
