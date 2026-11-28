import { expect, test, type Page } from '../../../../test/support/browserTest';
import { macSpecPage, phoneSpecPage, specTracker } from './support/viewSpecInboxFixture';

/**
 * Each "Blocked - needs you" row answers by itself, as the Mac app and as the iPhone app, in
 * headless Chromium with a made-up ask. TAKE_SCREENSHOT=true keeps the pictures in SCREENSHOT_DIR.
 */
test.setTimeout(90_000);

async function shot(page: Page, name: string) {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const directory = process.env.SCREENSHOT_DIR ?? 'test-results/row-choices';
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all(Array.from(document.images, (image) => image.decode()));
	});
	await page.screenshot({
		path: `${directory}/${process.env.SCREENSHOT_LABEL ?? 'current'}-${name}.png`,
		animations: 'disabled'
	});
}

async function rowChoices(page: Page, name: string) {
	const list = page.getByRole('list', { name: 'Needs you' });
	const choices = list.getByRole('region', { name: 'Choose an answer' }).getByRole('button');
	await expect(choices).toHaveText([/Approve.*Recommended/s, /Ask for changes/, /Other/]);
	await expect(page.getByRole('textbox', { name: 'Your answer' })).toHaveCount(0);
	const overflow = () => document.documentElement.scrollWidth - window.innerWidth;
	expect(await page.evaluate(overflow)).toBeLessThanOrEqual(0);
	await shot(page, `${name}-rows`);
	const [first, second] = await choices.evaluateAll((buttons) =>
		buttons.map((button) => {
			const { x, y, width } = button.getBoundingClientRect();
			return { x, y, width: Math.round(width) };
		})
	);
	expect.soft(second.y === first.y, 'Mac answer tiles share a row').toBe(name === 'mac');
	expect.soft(second.x === first.x, 'iPhone answer tiles share a column').toBe(name === 'iphone');
	expect.soft(second.width, 'Answer tiles have equal widths').toBe(first.width);
	await expect.soft(list.getByText('Starts the build.')).toHaveCount(0);
	return choices;
}

const sizes = { mac: { width: 1440, height: 900 }, iphone: { width: 390, height: 844 } };

async function ready(page: Page, size: keyof typeof sizes) {
	await page.setViewportSize(sizes[size]);
	await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
}

test('Mac: a tap on a row records the answer in the Tracker', async ({ page }) => {
	const tracker = await specTracker('# Notes service', 'notes-service.md');
	await ready(page, 'mac');
	const restore = await macSpecPage(page, tracker);
	try {
		await page.goto('/tracker');
		const choices = await rowChoices(page, 'mac');
		await choices.filter({ hasText: 'Ask for changes' }).click();
		await expect(page.getByText('Answer saved to Tracker.')).toBeVisible();
		await expect.poll(() => tracker.items.get('fixturespec').answer).toBe('Ask for changes');
		expect(tracker.items.get('fixturespec').answered_by).toBeTruthy();
	} finally {
		restore();
		tracker.close();
	}
});

test('Mac: Other on a row writes a different answer from a modal', async ({ page }) => {
	const tracker = await specTracker('# Notes service', 'notes-service.md');
	await ready(page, 'mac');
	const restore = await macSpecPage(page, tracker);
	try {
		await page.goto('/tracker');
		const choices = await rowChoices(page, 'mac');
		await choices.filter({ hasText: 'Other' }).click();
		const modal = page.getByRole('dialog', { name: 'Other answer' });
		await modal.getByRole('textbox', { name: 'Your answer' }).fill('Wait for Friday.');
		await shot(page, 'mac-row-other');
		await modal.getByRole('button', { name: 'Send answer' }).click();
		await expect.poll(() => tracker.items.get('fixturespec').answer).toBe('Wait for Friday.');
	} finally {
		restore();
		tracker.close();
	}
});

test('iPhone: a tap on a row queues the answer once through the phone', async ({ page }) => {
	const tracker = await specTracker('# Notes service', 'notes-service.md');
	const calls: string[] = [];
	await ready(page, 'iphone');
	try {
		await phoneSpecPage(page, tracker, calls);
		await page.goto('/tracker');
		const choices = await rowChoices(page, 'iphone');
		await choices.filter({ hasText: 'Ask for changes' }).click();
		await expect(page.getByText(/Answer confirmed and queued/)).toBeVisible();
		await shot(page, 'iphone-row-answered');
		await expect(choices).toHaveCount(0);
		expect(calls.filter((call) => call === 'tracker_answer')).toHaveLength(1);
	} finally {
		tracker.close();
	}
});
