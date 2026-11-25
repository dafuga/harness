import { expect, test, type Page } from '../../../../test/support/browserTest';
import { hubHomeFixture } from './hub-home-fixture';

/** Design details from specification/designs/hub-home that the screenshot matrix does not assert. */
test.setTimeout(60000);

async function home(page: Page, mode: 'default' | 'busy' | 'empty', width = 1440) {
	await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
	await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
	await hubHomeFixture(page, mode);
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

function card(page: Page, title: string) {
	return page.getByRole('region', { name: title, exact: true });
}

async function openDialog(page: Page, title: string) {
	await card(page, title)
		.getByRole('button', { name: /^(See all|All \d+)/ })
		.click();
	const dialog = page.getByRole('dialog', { name: title, exact: true });
	await expect(dialog).toBeVisible();
	return dialog;
}

test('empty cards explain themselves and offer one next step inside a quiet panel', async ({
	page
}) => {
	await home(page, 'empty');
	const steps = [
		['Agents', 'link', 'Connect a computer'],
		['Projects', 'link', 'Add a project']
	] as const;
	for (const [title, role, name] of steps)
		await expect(card(page, title).getByRole(role, { name, exact: true })).toBeVisible();
	const panel = card(page, 'Plans').locator('.hh-empty');
	await expect(panel).toContainText('Ask an agent to plan something');
	const edge = await panel.evaluate((element) => {
		const style = getComputedStyle(element);
		return { border: style.borderTopColor, text: style.color, width: style.borderTopWidth };
	});
	expect(edge.border).not.toBe(edge.text);
	expect(parseFloat(edge.width)).toBeLessThanOrEqual(1);
	const quota = card(page, 'Quota');
	await expect(quota.getByText('Connect subscriptions in the Harness Mac app.')).toBeVisible();
	await expect(quota.getByRole('button', { name: /connect/i })).toHaveCount(0);
});

test('avatars, quota warnings and dialog summaries follow the design', async ({ page }) => {
	await home(page, 'default');
	const agents = card(page, 'Agents');
	await expect(agents.locator('.hh-avatar').first()).toHaveText('CS');
	await expect(card(page, 'Quota').getByText('1 running low', { exact: true })).toBeVisible();
	const quota = await openDialog(page, 'Quota');
	await expect(quota.getByText('2 subscriptions · 1 running low', { exact: true })).toBeVisible();
	const claude = quota.getByRole('region', { name: 'Claude Code' });
	await expect(claude.getByText('OK', { exact: true })).toBeVisible();
	const [pill, head] = await Promise.all([
		claude.getByText('OK', { exact: true }).boundingBox(),
		claude.locator('.hh-q-sub-head').boundingBox()
	]);
	expect(head!.x + head!.width - (pill!.x + pill!.width)).toBeLessThan(24);
	await expect(
		quota.getByRole('region', { name: 'Codex' }).getByText('Low', { exact: true }).first()
	).toBeVisible();
	await expect(quota.getByText('Add a subscription', { exact: true })).toBeVisible();
	await expect(quota.getByText(/^Resets \d\d:\d\d · in \d+h \d+m$/).first()).toBeVisible();
	await page.keyboard.press('Escape');
	const summaries = [
		['Plans', '4 open · 1 done'],
		['Scheduled', /^\d+ upcoming · \d+ repea(t|ts|ting)/],
		['Projects', /^6 projects( · \d+ apps)?$/]
	] as const;
	for (const [title, summary] of summaries) {
		const dialog = await openDialog(page, title);
		await expect(dialog.locator('.po-totals')).toHaveText(summary);
		await page.keyboard.press('Escape');
	}
	const scheduled = await openDialog(page, 'Scheduled');
	await expect(
		scheduled.getByText(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d+ \w{3}$/).first()
	).toBeVisible();
});

test('an almost-out limit gets one callout with what, how much and the reset', async ({ page }) => {
	await home(page, 'busy');
	const callouts = card(page, 'Quota').locator('.hh-q-callout');
	await expect(callouts).toHaveCount(1);
	await expect(callouts).toContainText('Almost out');
	await expect(callouts).toContainText('3% left');
	await expect(callouts).toContainText(/Resets/);
});

test('the phone chat step names the agent in the dialog header', async ({ page }) => {
	await home(page, 'default', 390);
	const dialog = await openDialog(page, 'Agents');
	await dialog
		.getByRole('button', { name: /Chief of Staff/ })
		.first()
		.click();
	const chat = page.getByRole('dialog', { name: 'Chief of Staff', exact: true });
	await expect(chat.locator('.po-totals')).toHaveText(/Chat/);
	await chat.getByRole('button', { name: 'Back to agents' }).click();
	await expect(page.getByRole('dialog', { name: 'Agents', exact: true })).toBeVisible();
});

test('Daniel can add a session he created so it is listed under Agents', async ({ page }) => {
	await home(page, 'default');
	await expect(card(page, 'Agents').locator('.hh-agent-list')).not.toContainText('mine');
	const dialog = await openDialog(page, 'Agents');
	await dialog.getByLabel('Tracker agent of a session you created').fill('mine');
	await dialog.getByRole('button', { name: 'Add session' }).click();
	await expect(dialog.getByRole('button', { name: /^mine/ })).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'Remove mine' })).toBeVisible();
});
