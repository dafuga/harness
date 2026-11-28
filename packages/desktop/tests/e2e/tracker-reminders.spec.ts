import { DatabaseSync } from 'node:sqlite';
import { expect, test } from '../../../../test/support/browserTest';
import { TrackerItemReadRepository } from '../../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerRunReadRepository } from '../../../../src/repositories/projects-sessions/TrackerRunReadRepository';
import { TrackerLocalApiService } from '../../../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerPersistenceService } from '../../../../src/services/projects-sessions/TrackerPersistenceService';
import { macSpecPage } from './support/viewSpecInboxFixture';

/**
 * The Reminders view of the Mac inbox over a real in-memory Tracker. TAKE_SCREENSHOT=true keeps
 * the pictures in SCREENSHOT_DIR.
 */
test.setTimeout(60000);

const hour = 3_600_000;

function reminderTracker() {
	const database = new DatabaseSync(':memory:');
	const now = () => Date.now();
	const store = new TrackerPersistenceService(database, 'fixture-mac', { now });
	const items = new TrackerItemReadRepository(database);
	const runs = new TrackerRunReadRepository(database, store.node);
	const api = new TrackerLocalApiService(store, items, { now, runs });
	const add = (itemId: string, title: string, hours: number, every?: string) =>
		store.appendLocal({
			itemId,
			fields: {
				title,
				status: 'open',
				agent: 'personal',
				kind: 'reminder',
				remind_at: new Date(Date.now() + hours * hour).toISOString(),
				...(every && { every, every_tz: 'UTC' })
			}
		});
	add('plant00001', 'Reminder Sun 10:00: water the sample plant', -3, '0 10 * * 0');
	const room = 'Book a sample room before the long sample weekend at https://example.com/rooms';
	add('room000001', room, 30);
	store.appendLocal({
		itemId: 'work000001',
		fields: {
			title: 'Send the sample invoice',
			status: 'open',
			owner: 'Daniel',
			agent: 'sample-hub',
			due: new Date(Date.now() + 100 * hour).toISOString()
		}
	});
	const fetcher = (async (input: string | URL, init?: RequestInit) =>
		api.handle(new Request(String(input), init))) as typeof fetch;
	return { items, fetcher, close: () => database.close() };
}

for (const [size, width] of [
	['desktop', 1280],
	['narrow', 390]
] as const) {
	for (const scheme of ['dark', 'light'] as const) {
		test(`Reminders lists Work and Personal with done and snooze (${size}, ${scheme})`, async ({
			page
		}) => {
			const tracker = reminderTracker();
			const restore = await macSpecPage(page, tracker);
			try {
				await page.setViewportSize({ width, height: 844 });
				await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
				await page.goto('/tracker');
				await page.getByRole('button', { name: /^Reminders 3$/ }).click();
				const view = page.getByRole('region', { name: 'Reminders', exact: true });
				await expect(view.getByRole('heading', { level: 2 })).toHaveText(['Work', 'Personal']);
				const job = view.getByRole('list', { name: 'sample-hub' }).getByRole('listitem');
				await expect(job).toContainText(/Send the sample invoice\s*Due /);
				const rows = view.getByRole('list', { name: 'Personal' }).getByRole('listitem');
				await expect(rows).toHaveCount(2);
				await expect(rows.first()).toContainText(/Water the sample plant\s*Overdue · .*Weekly/s);
				const link = view.getByRole('link', { name: 'https://example.com/rooms' });
				await expect(link).toHaveAttribute('href', 'https://example.com/rooms');
				await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
				// A link is never nested inside the button that opens the item.
				await expect(view.locator('hx-button a, button a')).toHaveCount(0);
				await rows
					.first()
					.getByRole('button', { name: /^Snooze:/ })
					.click();
				const snooze = rows.first().getByRole('group', { name: 'Snooze until' });
				await expect(snooze.getByRole('button')).toHaveText(['Tomorrow 09:00', 'Next week']);
				if (process.env.TAKE_SCREENSHOT === 'true')
					await page.screenshot({
						path: `${process.env.SCREENSHOT_DIR ?? 'test-results/reminders'}/mac-${size}-${scheme}.png`,
						animations: 'disabled'
					});
				const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
				expect(scroll).toBeLessThanOrEqual(width);
				await snooze.getByRole('button', { name: 'Next week' }).click();
				await expect(page.getByText('Snooze saved to Tracker.')).toBeVisible();
				await expect(rows.first()).toContainText('Book a sample room');
				await rows
					.first()
					.getByRole('button', { name: /^Done:/ })
					.click();
				await expect(page.getByText('Done saved to Tracker.')).toBeVisible();
				await expect(rows).toHaveCount(1);
				expect(tracker.items.get('room000001').status).toBe('done');
				expect(tracker.items.get('plant00001').status).toBe('open');
			} finally {
				restore();
				tracker.close();
			}
		});
	}
}

test('a project inbox is project status, so it never lists personal reminders', async ({
	page
}) => {
	const tracker = reminderTracker();
	const restore = await macSpecPage(page, tracker);
	try {
		await page.goto('/tracker?project=sample');
		const filters = page.getByRole('navigation', { name: 'Filter items' });
		await expect(filters.getByRole('button', { name: /^All 0$/ })).toBeVisible();
		await expect(filters.getByRole('button', { name: /^Reminders/ })).toHaveCount(0);
	} finally {
		restore();
		tracker.close();
	}
});
