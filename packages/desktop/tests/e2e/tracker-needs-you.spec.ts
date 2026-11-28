import { expect, test, type Page } from '../../../../test/support/browserTest';
import {
	capturePlanWork,
	verifyPlanWork,
	verifyScheduledChat
} from './support/trackerWorkEvidence';
import { trackerWorkFixture } from './support/trackerWorkFixture';
import { macSpecPage, phoneSpecPage, specItem, specTracker } from './support/viewSpecInboxFixture';

/**
 * The "N need you" count sits with its items in the blocked section of the Mac and iPhone inbox,
 * in headless Chromium. TAKE_SCREENSHOT=true keeps the pictures in SCREENSHOT_DIR.
 */
test.setTimeout(60_000);

const sizes = { mac: { width: 1440, height: 900 }, iphone: { width: 390, height: 844 } };

async function blockedSection(page: Page, name: keyof typeof sizes) {
	await page.goto('/tracker');
	const section = page.getByRole('region', { name: 'Blocked - needs you' });
	await expect(section.getByText('1 needs you', { exact: true })).toBeVisible();
	await expect(
		section.getByRole('list', { name: 'Needs you' }).getByRole('button', { name: /Fixture/ })
	).toHaveCount(1);
	await expect(page.getByText(/\d+ needs? you/)).toHaveCount(1);
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const directory = process.env.SCREENSHOT_DIR ?? 'test-results/needs-you';
	await page.screenshot({ path: `${directory}/${name}-needs-you.png`, animations: 'disabled' });
}

for (const name of ['mac', 'iphone'] as const)
	test(`${name}: the needs-you count and its items share the blocked section`, async ({ page }) => {
		const tracker = await specTracker('# Notes service', 'notes-service.md');
		await page.setViewportSize(sizes[name]);
		await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
		const restore = name === 'mac' ? await macSpecPage(page, tracker) : undefined;
		try {
			if (name === 'iphone') await phoneSpecPage(page, tracker, []);
			const messages = await trackerWorkFixture(page, name);
			await blockedSection(page, name);
			await page.goto('/');
			const first = page.getByRole('main').locator('section').first();
			await expect(first).toHaveAccessibleName('Blocked - needs you');
			if (name === 'iphone') {
				await expect(first.getByText('1 needs you', { exact: true })).toBeVisible();
				await expect(first).toContainText('Approve the service spec');
				await capturePlanWork(page, name, 'home');
				const cleared = await tracker.fetcher(`http://127.0.0.1:7701/items/${specItem}/unflag`, {
					method: 'POST',
					body: '{}'
				});
				expect(cleared.ok).toBe(true);
				await page.reload();
				await expect(first).toHaveAccessibleName('Blocked - needs you');
			}
			await expect(first.getByText('0', { exact: true })).toBeVisible();
			await expect(first).toContainText('Nothing needs you right now');
			await capturePlanWork(page, name, 'home-empty');
			if (name === 'iphone')
				await page.getByRole('link', { name: 'Plans and schedule', exact: true }).click();
			await verifyPlanWork(page, name);
			await verifyScheduledChat(page, name, messages);
		} finally {
			restore?.();
			tracker.close();
		}
	});
