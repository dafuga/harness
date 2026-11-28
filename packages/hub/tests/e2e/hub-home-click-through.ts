import { readFileSync } from 'node:fs';
import type { HomePlan } from '../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';
import { expect, type Locator, type Page } from '../../../../test/support/browserTest';
import { capture, captureNeedsYou } from './hub-home-capture';
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

export async function planArtifacts(page: Page, plan?: HomePlan) {
	if (plan)
		Object.assign(plan, {
			stage: 'design',
			planning: {
				promotions: [],
				artifacts: {
					design: {
						summary: 'Approved designs for the dashboard.',
						pages: [
							{
								name: 'Dashboard',
								states: { ready: 'Shows the latest plan activity.' },
								links: [
									{
										kind: 'image',
										label: 'Dashboard mockup',
										url: 'https://design.example.test/dashboard.png'
									},
									{
										kind: 'link',
										label: 'Dashboard design canvas',
										url: 'https://design.example.test/canvas'
									}
								]
							}
						]
					}
				}
			}
		});
	await page.route('https://design.example.test/dashboard.png', (route) =>
		route.fulfill({
			contentType: 'image/png',
			body: readFileSync(new URL('../../static/icons/harness-512.png', import.meta.url))
		})
	);
}

export async function expectAnswerGrid(choices: Locator, phone: boolean) {
	const tiles = await choices.evaluateAll((buttons) =>
		buttons.map((button) => {
			const { x, y, width } = button.getBoundingClientRect();
			return { x, y, width: Math.round(width) };
		})
	);
	const [first, second] = tiles;
	expect.soft(second.y === first.y, 'Answer tiles share a row above phone widths').toBe(!phone);
	expect.soft(second.x === first.x, 'Phone answer tiles share a column').toBe(phone);
	expect
		.soft(
			tiles.map(({ width }) => width),
			'Answer tiles have equal widths'
		)
		.toEqual(tiles.map(() => first.width));
}

export async function expectAnswerDialogs(
	page: Page,
	deploy: Locator,
	screens: { confirm: string; other: string }
) {
	await deploy.getByRole('button', { name: /Approve Saturday/ }).click();
	const confirmation = page.getByRole('dialog', { name: 'Confirm answer' });
	await expect(confirmation.getByText('Approve Saturday 09:00', { exact: true })).toBeVisible();
	await expect(deploy.getByRole('group', { name: /Confirm this deploy answer/ })).toHaveCount(0);
	await captureNeedsYou(page, screens.confirm);
	await page.keyboard.press('Escape');
	await expect(confirmation).toHaveCount(0);
	await expect(deploy.getByRole('button', { name: /Approve Saturday/ })).toBeFocused();
	const other = deploy.getByRole('button', { name: 'Other…', exact: true });
	await other.click();
	const answer = page.getByRole('dialog', { name: 'Other answer' });
	await expect(answer.getByRole('textbox', { name: 'Your answer' })).toBeFocused();
	await expect(deploy.locator('input, textarea, select, form')).toHaveCount(0);
	await captureNeedsYou(page, screens.other);
	await page.keyboard.press('Escape');
	await expect(answer).toHaveCount(0);
	await expect(other).toBeFocused();
}

export const needsYou = (page: Page) => page.getByRole('region', { name: /^Blocked - needs you/ });
export const openers = (page: Page) =>
	needsYou(page).getByRole('button', { name: 'Talk to Chief of Staff', exact: true });
export const widget = (page: Page) =>
	page.getByRole('dialog', { name: 'Chief of Staff', exact: true });
export const talk = (page: Page, project: string) =>
	rowOf(page, project).getByRole('button', { name: 'Talk to Chief of Staff', exact: true });
export const rowOf = (page: Page, project: string) =>
	needsYou(page).getByRole('listitem').filter({ hasText: project });
export const agentsCard = (page: Page) => page.getByRole('region', { name: 'Agents', exact: true });
