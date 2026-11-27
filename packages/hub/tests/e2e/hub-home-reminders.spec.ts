import { expect, test, type Page } from '../../../../test/support/browserTest';
import { homeClock } from './hub-home-fixture-data';
import { hubHomeFixture } from './hub-home-fixture';

/**
 * Reminders on Home: one Personal group, each row with its next time, Done and Snooze.
 * TAKE_SCREENSHOT=true keeps the pictures in SCREENSHOT_DIR.
 */
test.setTimeout(60000);

const sizes = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
const armed = (hours: number) => new Date(homeClock + hours * 3_600_000).toISOString();
const titles = [
	'Water the sample plant',
	'Pick up sample groceries on the way home from the long walk by the river',
	'Book a sample room at https://example.com/rooms',
	'Send the sample follow-up',
	'Charge the sample camera',
	'Renew the sample card'
];
const reminders = titles.map((title, index) => ({
	itemId: `reminder-${index}`,
	title,
	at: armed(index * 20 - 3),
	repeats: index === 0 ? 'Weekly' : null,
	updatedAt: armed(-24)
}));

async function shot(page: Page, name: string) {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const directory = process.env.SCREENSHOT_DIR ?? 'test-results/reminders';
	await page.screenshot({
		path: `${directory}/${name}.png`,
		animations: 'disabled',
		fullPage: true
	});
}

/** The gap in pixels between each pair of neighbours, along one axis. */
const gaps = (boxes: { x: number; y: number; width: number; height: number }[]) =>
	boxes.slice(1).map((box, index) => box.x - boxes[index].x - boxes[index].width);

for (const size of ['desktop', 'phone'] as const) {
	for (const scheme of ['dark', 'light'] as const) {
		test(`Reminders list the Personal group with done and snooze (${size}, ${scheme})`, async ({
			page
		}) => {
			await page.setViewportSize(sizes[size]);
			await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
			const fixture = await hubHomeFixture(page, 'default');
			fixture.snapshot.reminders = reminders;
			await page.goto('/');
			const section = page.getByRole('region', { name: 'Reminders', exact: true });
			await expect(section.getByRole('heading', { name: 'Personal' })).toBeVisible();
			const rows = section.getByRole('listitem');
			await expect(rows).toHaveCount(5);
			await expect(rows.first()).toContainText('Due now');
			const link = section.getByRole('link', { name: 'https://example.com/rooms' });
			await expect(link).toHaveAttribute('href', 'https://example.com/rooms');
			await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
			await expect(rows.first()).toContainText('Weekly');
			await shot(page, `${size}-${scheme}-list`);

			const buttons = rows.first().getByRole('button');
			const boxes = await Promise.all(
				(await buttons.all()).map(async (button) => (await button.boundingBox())!)
			);
			for (const gap of gaps(boxes)) expect(gap).toBeGreaterThanOrEqual(8);
			const width = await page.evaluate(() => document.documentElement.scrollWidth);
			expect(width).toBeLessThanOrEqual(sizes[size].width);

			await section.getByRole('button', { name: `Snooze: ${titles[0]}` }).click();
			const snooze = rows.first().getByRole('group', { name: 'Snooze until' });
			await expect(snooze.getByRole('button')).toHaveText(['1 hour', 'Tomorrow 09:00', '1 week']);
			await shot(page, `${size}-${scheme}-snooze`);
			await snooze.getByRole('button', { name: '1 hour' }).click();
			await expect(rows.first().getByRole('status')).toHaveText('Saved', { timeout: 15000 });
			await section.getByRole('button', { name: `Done: ${titles[1]}` }).click();
			await expect(rows.nth(1).getByRole('status')).toHaveText('Saved', { timeout: 15000 });
			expect(fixture.sent).toMatchObject([
				{ kind: 'reminder-snooze', itemId: 'reminder-0', armed: reminders[0].at, until: armed(1) },
				{ kind: 'reminder-done', itemId: 'reminder-1', armed: reminders[1].at }
			]);
			await shot(page, `${size}-${scheme}-saved`);
			await section.getByRole('button', { name: 'Show all 6' }).click();
			await expect(rows).toHaveCount(6);
		});
	}
}

test('the Needs you destination never lists personal reminders', async ({ page }) => {
	const fixture = await hubHomeFixture(page, 'default');
	fixture.snapshot.reminders = reminders;
	await page.goto('/?view=needs-you');
	await expect(page.getByRole('region', { name: /needs you/i }).first()).toBeVisible();
	await expect(page.getByRole('region', { name: 'Reminders', exact: true })).toHaveCount(0);
});

for (const size of ['desktop', 'phone'] as const) {
	test(`a long reminder is shown whole, in an evenly padded card (${size})`, async ({ page }) => {
		await page.setViewportSize(sizes[size]);
		const fixture = await hubHomeFixture(page, 'default');
		const title = 'Plan the sample weekend away and book every sample ticket. '.repeat(7).trim();
		fixture.snapshot.reminders = [{ ...reminders[1], title }];
		await page.goto('/');
		const section = page.getByRole('region', { name: 'Reminders', exact: true });
		const text = section.getByText(title, { exact: true });
		await expect(text).toBeVisible();
		const hidden = await text.evaluate((node) => {
			const clipped = node.closest('.hh-reminder-title')!;
			return clipped.scrollHeight - clipped.clientHeight;
		});
		expect(hidden).toBeLessThanOrEqual(1);
		const card = (await section.boundingBox())!;
		const heading = (await section.getByRole('heading', { name: 'Reminders' }).boundingBox())!;
		const content = [
			...(await section.getByRole('button').all()),
			section.locator('.hh-reminder-text')
		];
		const boxes = await Promise.all(content.map(async (item) => (await item.boundingBox())!));
		const below = card.y + card.height - Math.max(...boxes.map((box) => box.y + box.height));
		// The gap under the lowest content matches the gap over the heading.
		expect(Math.abs(below - (heading.y - card.y))).toBeLessThanOrEqual(2);
	});
}
