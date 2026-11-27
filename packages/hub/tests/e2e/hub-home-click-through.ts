import { expect, type Locator, type Page } from '../../../../test/support/browserTest';
import { capture } from './hub-home-capture';
import type { CapturePosition, HomeFixture } from './hub-home-fixture.types';

export async function planClickThrough(
	page: Page,
	position: CapturePosition,
	fixture: HomeFixture
) {
	const plan = fixture.snapshot.plans[0];
	const card = page.getByRole('region', { name: 'Plans', exact: true });
	const preview = card.getByRole('button', { name: plan.title, exact: true });
	await card.scrollIntoViewIfNeeded();
	await capture(page, position, 'plan-preview');
	await expect.soft(preview).toBeVisible({ timeout: 3000 });
	if (!(await preview.isVisible())) return;
	await checkPlan(page, position, preview, plan.title, 'plan-detail');
	const all = card.getByRole('button', { name: 'See all plans' });
	await all.click();
	const list = page.getByRole('dialog', { name: 'Plans', exact: true });
	await checkPlan(
		page,
		position,
		list.getByRole('button', { name: plan.title, exact: true }),
		plan.title,
		'all-plans-detail'
	);
	await expect(list).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(all).toBeFocused();
}

async function checkPlan(
	page: Page,
	position: CapturePosition,
	opener: Locator,
	title: string,
	screen: string
) {
	await expect(opener).toBeVisible({ timeout: 3000 });
	await opener.click();
	const detail = page.getByRole('dialog', { name: title, exact: true });
	await expect(detail.getByText('Approved designs for the dashboard.')).toBeVisible();
	const image = detail.getByRole('img', { name: 'Dashboard mockup' });
	await expect(image).toBeVisible();
	await expect
		.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
		.toBeGreaterThan(0);
	const canvas = detail.getByRole('link', { name: 'Dashboard design canvas' });
	await expect(canvas).toHaveAttribute('href', 'https://design.example.test/canvas');
	await expect(canvas).toHaveAttribute('target', '_blank');
	await capture(page, position, screen);
	await page.keyboard.press('Escape');
	await expect(opener).toBeFocused();
}

export async function scheduledClickThrough(
	page: Page,
	position: CapturePosition,
	fixture: HomeFixture
) {
	const run = fixture.snapshot.scheduled.find(({ source }) => source === 'tracker')!;
	const card = page.getByRole('region', { name: 'Scheduled', exact: true });
	const opener = card.getByRole('button', { name: run.title, exact: true });
	await card.scrollIntoViewIfNeeded();
	await capture(page, position, 'scheduled-preview');
	await expect(opener).toBeVisible({ timeout: 3000 });
	await opener.click();
	const chat = page.getByRole('dialog', { name: 'Chief of Staff', exact: true });
	await expect(chat.getByLabel('Attached item')).toContainText(run.title);
	await capture(page, position, 'scheduled-chat');
	await chat.getByRole('textbox', { name: 'Message Chief of Staff' }).fill('Can we move this?');
	await chat.getByRole('button', { name: 'Send', exact: true }).click();
	await expect(chat.getByRole('status')).toHaveText('Queued for Tracker');
	expect(fixture.sent.at(-1)).toMatchObject({
		agentId: 'cos',
		itemId: 'cos',
		kind: 'message',
		text: expect.stringContaining(run.id)
	});
	expect(fixture.sent.at(-1)).toMatchObject({ text: expect.stringContaining('Can we move this?') });
	await page.keyboard.press('Escape');
	await expect(opener).toBeFocused();
	const all = card.getByRole('button', { name: 'See all scheduled runs' });
	await all.click();
	const list = page.getByRole('dialog', { name: 'Scheduled', exact: true });
	const scheduled = list.getByRole('button', { name: run.title, exact: true });
	await scheduled.click();
	await expect(chat.getByLabel('Attached item')).toContainText(run.title);
	await page.keyboard.press('Escape');
	await expect(scheduled).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(all).toBeFocused();
}
