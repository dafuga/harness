import { expect, type Locator, type Page } from '../../../../../test/support/browserTest';
import type { TrackerItemReadRepository } from '../../../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import type { HomeChatInput } from '../../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';
import { canvasUrl, planTitle, scheduledId, scheduledTitle } from './trackerWorkFixture';

export async function capturePlanWork(page: Page, mode: string, screen: string) {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all(Array.from(document.images, (image) => image.decode()));
	});
	const directory = process.env.SCREENSHOT_DIR ?? 'test-results/needs-you';
	await page.screenshot({ path: `${directory}/${mode}-${screen}.png`, animations: 'disabled' });
}

async function checkDetail(page: Page, opener: Locator, mode: string, screen: string) {
	await opener.click();
	const detail = page.getByRole('dialog', { name: planTitle, exact: true });
	await expect(detail.getByText('Approved fixture design')).toBeVisible();
	const image = detail.getByRole('img', { name: 'Fixture mockup' });
	await expect(image).toBeVisible();
	await expect
		.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
		.toBeGreaterThan(0);
	await expect(detail.getByRole('link', { name: 'Fixture design canvas' })).toHaveAttribute(
		'href',
		canvasUrl
	);
	await capturePlanWork(page, mode, screen);
	await page.keyboard.press('Escape');
	await expect(opener).toBeFocused();
}

export async function verifyPlanWork(page: Page, mode: string) {
	const region = page.getByRole('region', { name: 'Plans', exact: true });
	await expect(region).toBeVisible();
	expect(
		await region.evaluate((element) => {
			const box = element.getBoundingClientRect();
			return (
				box.left >= 16 &&
				box.right <= innerWidth - 16 &&
				parseFloat(getComputedStyle(element).borderTopWidth) > 0
			);
		})
	).toBe(true);
	await capturePlanWork(page, mode, 'work');
	await checkDetail(
		page,
		region.getByRole('button', { name: planTitle, exact: true }),
		mode,
		'plan-detail'
	);
	const all = region.getByRole('button', { name: 'See all plans' });
	await all.click();
	const dialog = page.getByRole('dialog', { name: 'Plans', exact: true });
	await checkDetail(
		page,
		dialog.getByRole('button', { name: planTitle, exact: true }),
		mode,
		'all-plans-detail'
	);
	await page.keyboard.press('Escape');
	await expect(all).toBeFocused();
}

export async function verifyScheduledChat(page: Page, mode: string, messages: HomeChatInput[]) {
	const opener = page
		.getByRole('region', { name: 'Scheduled', exact: true })
		.getByRole('button', { name: scheduledTitle, exact: true });
	await opener.click();
	const dialog = page.getByRole('dialog', { name: 'Chief of Staff', exact: true });
	await expect(dialog.getByLabel('Attached item')).toContainText(scheduledTitle);
	await capturePlanWork(page, mode, 'schedule-chat');
	await dialog
		.getByRole('textbox', { name: 'Message Chief of Staff' })
		.fill('Can we move the review?');
	await dialog.getByRole('button', { name: 'Send', exact: true }).click();
	await expect
		.poll(() => messages)
		.toMatchObject([
			{ agentId: 'cos', itemId: 'cos', kind: 'message', text: expect.stringContaining(scheduledId) }
		]);
	await page.keyboard.press('Escape');
	await expect(opener).toBeFocused();
}

export async function verifyMacSchedule(
	page: Page,
	mode: string,
	items: TrackerItemReadRepository
) {
	const opener = page
		.getByRole('region', { name: 'Scheduled', exact: true })
		.getByRole('button', { name: scheduledTitle, exact: true });
	await opener.click();
	const dialog = page.getByRole('dialog', { name: 'Chief of Staff', exact: true });
	await expect(dialog.getByLabel('Attached item')).toContainText(scheduledTitle);
	await capturePlanWork(page, mode, 'schedule-chat');
	await dialog
		.getByRole('textbox', { name: 'Message Chief of Staff' })
		.fill('Can we move the review?');
	await dialog.getByRole('button', { name: 'Send', exact: true }).click();
	await expect
		.poll(() =>
			items
				.list({ agent: 'cos', status: 'all' })
				.flatMap((item) => item.notes_log.map(({ text }) => text))
				.join(' ')
		)
		.toContain(scheduledId);
	await page.keyboard.press('Escape');
	await expect(opener).toBeFocused();
}
