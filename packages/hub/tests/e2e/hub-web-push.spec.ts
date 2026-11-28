import { expect, test, type Page } from '../../../../test/support/browserTest';
import { pushAddress, webPushFixture } from './hub-web-push-fixture';
import { open, row, shot, shown } from './hub-web-push-page';

/**
 * Browser notifications on Home. TAKE_SCREENSHOT=true keeps the pictures in SCREENSHOT_DIR.
 */
test.setTimeout(60000);
// The headless shell has no notification permission; the full headless Chromium does.
test.use({ channel: 'chromium' });

/** No sideways scrolling, and the row keeps clear space from what is around it. */
async function spaced(page: Page) {
	const layout = await page.evaluate(() => {
		const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
		const notify = box('.hh-notify');
		const parts = [...document.querySelector('.hh-notify')!.children].map((part) =>
			part.getBoundingClientRect()
		);
		const above = document.querySelector('.hh-notify')!.previousElementSibling!;
		return {
			wide: document.documentElement.scrollWidth - innerWidth,
			left: notify.left,
			above: notify.top - above.getBoundingClientRect().bottom,
			below: box('.hh-needs').top - notify.bottom,
			between: parts.slice(1).map((part, index) => {
				const last = parts[index];
				return part.top >= last.bottom ? part.top - last.bottom : part.left - last.right;
			}),
			targets: [...document.querySelectorAll('.hh-notify button')].map(
				(button) => button.getBoundingClientRect().height
			)
		};
	});
	expect(layout.wide).toBeLessThanOrEqual(0);
	expect(layout.left).toBeGreaterThanOrEqual(16);
	expect(layout.above).toBeGreaterThanOrEqual(8);
	expect(layout.below).toBeGreaterThanOrEqual(12);
	for (const gap of layout.between) expect(gap).toBeGreaterThanOrEqual(8);
	return layout.targets;
}

for (const size of ['desktop', 'tablet', 'phone'] as const) {
	test(`turns notifications on, changes quiet hours and turns them off (${size})`, async ({
		page
	}) => {
		const { writes } = await webPushFixture(page, { permission: 'default' });
		await open(page, size);
		const button = row(page).getByRole('button', { name: 'Turn on notifications' });
		await expect(button).toBeVisible();
		await expect(row(page)).toContainText('even with this tab closed');
		expect(writes).toEqual([]);
		for (const height of await spaced(page))
			expect(height).toBeGreaterThanOrEqual(size === 'phone' ? 44 : 36);
		await shot(page, `notifications-off-${size}`);

		await button.click();
		await expect(row(page).getByRole('status')).toHaveText(
			'Notifications on · quiet 22:00–08:00 Lisbon'
		);
		expect(writes[0]).toMatchObject({
			method: 'POST',
			path: '/api/push/subscription',
			body: { endpoint: pushAddress }
		});
		await expect.poll(() => shown(page)).toMatchObject([{ title: 'Notifications are on' }]);
		await spaced(page);
		await shot(page, `notifications-on-${size}`);

		await row(page).getByRole('button', { name: 'Notification settings' }).click();
		const dialog = page.getByRole('dialog', { name: 'Notifications' });
		await expect(dialog).toContainText('every 15 minutes while any stays open');
		await expect(dialog).toContainText('No decision notification has reached this browser yet.');
		await expect(dialog.getByRole('checkbox', { name: /Quiet hours/ })).toBeChecked();
		await expect(dialog.getByLabel('From')).toHaveValue('22:00');
		await shot(page, `notifications-settings-${size}`);
		await dialog.getByLabel('Until').fill('07:30');
		await dialog.getByRole('button', { name: 'Save' }).click();
		await expect(dialog).toBeHidden();
		expect(writes.at(-1)).toEqual({
			method: 'POST',
			path: '/api/push',
			body: { quiet: { enabled: true, start: '22:00', end: '07:30' } }
		});
		await expect(row(page).getByRole('status')).toContainText('quiet 22:00–07:30');

		await row(page).getByRole('button', { name: 'Notification settings' }).click();
		await dialog.getByRole('checkbox', { name: /Quiet hours/ }).uncheck();
		await expect(dialog.getByLabel('From')).toBeDisabled();
		await dialog.getByRole('button', { name: 'Save' }).click();
		await expect(row(page).getByRole('status')).toHaveText('Notifications on · no quiet hours');

		await row(page).getByRole('button', { name: 'Notification settings' }).click();
		await dialog.getByRole('button', { name: 'Turn off on this device' }).click();
		await expect(button).toBeVisible();
		expect(writes.at(-1)).toEqual({
			method: 'DELETE',
			path: '/api/push/subscription',
			body: { endpoint: pushAddress }
		});
	});
}

for (const size of ['desktop', 'phone'] as const) {
	test(`a blocked browser says how to allow notifications (${size})`, async ({ page }) => {
		await webPushFixture(page, { permission: 'default', answer: 'denied' });
		await open(page, size);
		await row(page).getByRole('button', { name: 'Turn on notifications' }).click();
		await expect(row(page)).toContainText('Notifications are blocked.');
		await expect(row(page).getByRole('button')).toHaveCount(0);
		await spaced(page);
		await shot(page, `notifications-blocked-${size}`);
	});
}

test('an iPhone browser tab is told to add Harness to the Home Screen', async ({ page }) => {
	await webPushFixture(page, { permission: 'default' });
	await page.addInitScript(() => {
		Reflect.deleteProperty(window, 'PushManager');
		Object.defineProperty(navigator, 'userAgent', { get: () => 'Synthetic iPhone Safari' });
	});
	await open(page, 'phone');
	await expect(row(page)).toContainText('add Harness to your Home Screen');
	await spaced(page);
	await shot(page, 'notifications-iphone-phone');
});

for (const size of ['desktop', 'phone'] as const) {
	test(`a failed turn-on says so in the error colour and can be retried (${size})`, async ({
		page,
		baseURL,
		browserErrors
	}) => {
		await webPushFixture(page, { permission: 'default' });
		// Registered last, so the save itself fails once.
		await page.route(
			/\/api\/push\/subscription$/,
			(route) => route.fulfill({ status: 500, json: { error: 'unavailable' } }),
			{ times: 1 }
		);
		browserErrors.expectError({
			type: 'console',
			message:
				'Failed to load resource: the server responded with a status of 500 (Internal Server Error)',
			source: `${baseURL}/api/push/subscription`,
			reason: 'This case makes saving the subscription fail once.'
		});
		await open(page, size);
		const button = row(page).getByRole('button', { name: 'Turn on notifications' });
		await button.click();
		const alert = row(page).getByRole('alert');
		await expect(alert).toHaveText('Notifications could not be turned on. Try again.');
		const colours = await alert.evaluate((element) => {
			const probe = document.createElement('i');
			probe.style.color = 'var(--hx-color-error)';
			element.after(probe);
			const wanted = getComputedStyle(probe).color;
			probe.remove();
			return { shown: getComputedStyle(element).color, wanted };
		});
		expect(colours.shown).toBe(colours.wanted);
		await spaced(page);
		await shot(page, `notifications-failed-${size}`);
		await button.click();
		await expect(row(page).getByRole('status')).toContainText('Notifications on');
		await expect(alert).toHaveCount(0);
	});
}

test('signing out unsubscribes this browser first', async ({ page }) => {
	const { writes } = await webPushFixture(page, { permission: 'default' });
	await open(page, 'desktop');
	await row(page).getByRole('button', { name: 'Turn on notifications' }).click();
	await expect(row(page).getByRole('status')).toContainText('Notifications on');
	await page.getByRole('button', { name: 'Account' }).click();
	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page.getByRole('main', { name: 'Sign in to Harness' })).toBeVisible();
	expect(writes.at(-1)).toEqual({
		method: 'DELETE',
		path: '/api/push/subscription',
		body: { endpoint: pushAddress }
	});
	expect(await page.evaluate(() => localStorage.getItem('test-push-held'))).toBeNull();
});

test('a Hub without notifications shows no control', async ({ page }) => {
	await webPushFixture(page, { permission: 'default', unavailable: true });
	const answered = page.waitForResponse(/\/api\/push$/);
	await open(page, 'desktop');
	await answered;
	await expect(row(page)).toHaveCount(0);
});
