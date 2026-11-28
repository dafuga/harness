import { expect, test, type Page } from '../../../../test/support/browserTest';
import { homeClock } from './hub-home-fixture-data';
import { hubHomeFixture } from './hub-home-fixture';
import { snoozeChoices } from '../../../reports/src/lib/projects-sessions/hub-home/reminderTimes';

/**
 * Upcoming reminders on Home: Work by project and Personal, each row with its time, Done and Snooze.
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
const personal = titles.map((title, index) => ({
	itemId: `reminder-${index}`,
	title,
	at: armed(index * 20 - 3),
	repeats: index === 0 ? 'Weekly' : null,
	group: 'personal' as const,
	project: null,
	updatedAt: armed(-24)
}));
const deadline = armed(166);
const snacks = {
	...personal[1],
	itemId: 'snacks',
	title: 'Get the snacks from Sintra and Porto',
	at: deadline,
	due: deadline
};
const work = [
	{ itemId: 'work-0', title: 'Renew the sample sign-in', project: 'sample-hub', at: armed(-70) },
	{ itemId: 'work-1', title: 'Check the sample approvals', project: 'sample-chain', at: armed(44) },
	{ itemId: 'work-2', title: 'Send the sample invoice', project: 'sample-hub', at: armed(90) }
].map((entry) => ({ ...personal[0], ...entry, repeats: null, group: 'work' as const }));
const reminders = [...work, ...personal.slice(0, 4), snacks, ...personal.slice(4)].sort((a, b) =>
	a.at.localeCompare(b.at)
);

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
		test(`Upcoming reminders list Work and Personal with done and snooze (${size}, ${scheme})`, async ({
			page
		}) => {
			await page.setViewportSize(sizes[size]);
			await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
			const fixture = await hubHomeFixture(page, 'default');
			fixture.snapshot.reminders = reminders;
			await page.goto('/');
			const section = page.getByRole('region', { name: 'Upcoming reminders', exact: true });
			const mine = section.getByRole('region', { name: 'Personal' });
			const jobs = section.getByRole('region', { name: 'Work' });
			await expect(jobs.getByRole('heading', { level: 4 })).toHaveText([
				'sample-hub',
				'sample-chain'
			]);
			await expect(jobs.getByRole('listitem')).toHaveCount(3);
			await expect(jobs.getByRole('listitem').first()).toContainText(/Overdue · /);
			const rows = mine.getByRole('listitem');
			await expect(rows).toHaveCount(5);
			await expect(rows.first()).toContainText(/Overdue · /);
			await expect(rows.first()).toContainText('Weekly');
			const link = mine.getByRole('link', { name: 'https://example.com/rooms' });
			await expect(link).toHaveAttribute('href', 'https://example.com/rooms');
			await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
			await expect(section.locator('input, textarea, select')).toHaveCount(0);
			await shot(page, `${size}-${scheme}-list`);

			const buttons = rows.first().getByRole('button');
			const boxes = await Promise.all(
				(await buttons.all()).map(async (button) => (await button.boundingBox())!)
			);
			for (const gap of gaps(boxes)) expect(gap).toBeGreaterThanOrEqual(8);
			const width = await page.evaluate(() => document.documentElement.scrollWidth);
			expect(width).toBeLessThanOrEqual(sizes[size].width);

			await mine.getByRole('button', { name: `Snooze: ${titles[0]}` }).click();
			const snooze = rows.first().getByRole('group', { name: 'Snooze until' });
			await expect(snooze.getByRole('button')).toHaveText(['Tomorrow 09:00', 'Next week']);
			await shot(page, `${size}-${scheme}-snooze`);
			await snooze.getByRole('button', { name: 'Tomorrow 09:00' }).click();
			await expect(rows.first().getByRole('status')).toHaveText('Saved', { timeout: 15000 });
			await mine.getByRole('button', { name: `Done: ${titles[1]}` }).click();
			await expect(rows.nth(1).getByRole('status')).toHaveText('Saved', { timeout: 15000 });
			expect(fixture.sent).toMatchObject([
				{
					kind: 'reminder-snooze',
					itemId: 'reminder-0',
					armed: personal[0].at,
					until: snoozeChoices(homeClock)[0].until
				},
				{ kind: 'reminder-done', itemId: 'reminder-1', armed: personal[1].at }
			]);
			await shot(page, `${size}-${scheme}-saved`);
			await mine.getByRole('button', { name: 'Show all 7' }).click();
			await expect(rows).toHaveCount(7);
			await expect(rows.filter({ hasText: snacks.title })).toContainText(/Due \w{3} \d/);
			await shot(page, `${size}-${scheme}-all`);
		});
	}
}

test('the Needs you destination never lists personal reminders', async ({ page }) => {
	const fixture = await hubHomeFixture(page, 'default');
	fixture.snapshot.reminders = reminders;
	await page.goto('/?view=needs-you');
	await expect(page.getByRole('region', { name: /needs you/i }).first()).toBeVisible();
	await expect(page.getByRole('region', { name: 'Upcoming reminders', exact: true })).toHaveCount(
		0
	);
});

for (const size of ['desktop', 'phone'] as const) {
	test(`a long reminder is shown whole, in an evenly padded card (${size})`, async ({ page }) => {
		await page.setViewportSize(sizes[size]);
		const fixture = await hubHomeFixture(page, 'default');
		const title = 'Plan the sample weekend away and book every sample ticket. '.repeat(7).trim();
		fixture.snapshot.reminders = [{ ...personal[1], title }];
		await page.goto('/');
		const section = page.getByRole('region', { name: 'Upcoming reminders', exact: true });
		const text = section.getByText(title, { exact: true });
		await expect(text).toBeVisible();
		const hidden = await text.evaluate((node) => {
			const clipped = node.closest('.hh-reminder-title')!;
			return clipped.scrollHeight - clipped.clientHeight;
		});
		expect(hidden).toBeLessThanOrEqual(1);
		const card = (await section.boundingBox())!;
		const heading = (await section
			.getByRole('heading', { name: 'Upcoming reminders' })
			.boundingBox())!;
		const content = [
			...(await section.getByRole('button').all()),
			section.locator('.hh-reminder-text'),
			...(await section.getByText(/^No work reminders/).all())
		];
		const boxes = await Promise.all(content.map(async (item) => (await item.boundingBox())!));
		const below = card.y + card.height - Math.max(...boxes.map((box) => box.y + box.height));
		// The gap under the lowest content matches the gap over the heading.
		expect(Math.abs(below - (heading.y - card.y))).toBeLessThanOrEqual(2);
	});
}
